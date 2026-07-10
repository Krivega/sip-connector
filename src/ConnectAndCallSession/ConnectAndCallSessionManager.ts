import { isCanceledError } from '@krivega/cancelable-promise';
import { hasCanceledError } from 'repeated-calls';

import { hasNotReadyForConnectionError } from '@/ConnectionManager';
import resolveDebug from '@/logger';
import { ConnectAndCallSessionStateMachine } from './ConnectAndCallSessionStateMachine';
import { EConnectAndCallSessionPhase } from './types';

import type { AutoConnectorManager } from '@/AutoConnectorManager';
import type { CallReconnectManager } from '@/CallReconnectManager';
import type { ConnectionManager, TParametersConnection } from '@/ConnectionManager';
import type {
  IConnectAndCallSession,
  TConnectAndCallSessionCloseReason,
  TConnectAndCallSessionParameters,
  TConnectAndCallSessionStartResult,
  TConnectAndCallSessionTeardown,
} from './types';

const debug = resolveDebug('ConnectAndCallSessionManager');

type TDependencies = {
  autoConnectorManager: AutoConnectorManager;
  callReconnectManager: CallReconnectManager;
  connectionManager: Pick<ConnectionManager, 'getConnectionConfiguration'>;
  teardown: TConnectAndCallSessionTeardown;
};

const hasSoftConnectionError = (error: unknown): boolean => {
  return (
    isCanceledError(error) ||
    hasCanceledError(error as Error) ||
    hasNotReadyForConnectionError(error)
  );
};

class ConnectAndCallSessionManager implements IConnectAndCallSession {
  public readonly stateMachine = new ConnectAndCallSessionStateMachine();

  private readonly autoConnectorManager: AutoConnectorManager;

  private readonly callReconnectManager: CallReconnectManager;

  private readonly connectionManager: TDependencies['connectionManager'];

  private readonly teardown: TConnectAndCallSessionTeardown;

  private readonly unsubscribes: (() => void)[] = [];

  private finalizePromise: Promise<void> | undefined;

  private finalizationReason: TConnectAndCallSessionCloseReason | undefined;

  private isCallStartPending = false;

  private readonly closedPromise: Promise<TConnectAndCallSessionCloseReason>;

  private resolveClosed!: (reason: TConnectAndCallSessionCloseReason) => void;

  public constructor({
    autoConnectorManager,
    callReconnectManager,
    connectionManager,
    teardown,
  }: TDependencies) {
    this.autoConnectorManager = autoConnectorManager;
    this.callReconnectManager = callReconnectManager;
    this.connectionManager = connectionManager;
    this.teardown = teardown;
    this.closedPromise = new Promise((resolve) => {
      this.resolveClosed = resolve;
    });
  }

  public get phase(): EConnectAndCallSessionPhase {
    return this.stateMachine.state;
  }

  public start = async ({
    connection,
    startCall,
  }: TConnectAndCallSessionParameters): Promise<TConnectAndCallSessionStartResult> => {
    this.stateMachine.send({ type: 'START' });

    if (this.autoConnectorManager.isActive) {
      const reason = 'auto-connector-active';

      this.stateMachine.send({ type: 'REJECT', reason });
      this.resolveClosed(reason);

      return {
        configuration: undefined,
        isSuccessful: false,
        peerConnection: undefined,
        reason,
      };
    }

    const getParameters =
      typeof connection.parameters === 'function'
        ? connection.parameters
        : async () => {
            return connection.parameters as TParametersConnection;
          };
    const autoConnectResult = await this.autoConnectorManager.start({
      getParameters,
      options: connection.options,
    });

    if (this.hasFinalizationStarted()) {
      return this.createInterruptedStartResult();
    }

    if (!autoConnectResult.isSuccess) {
      const reason = hasSoftConnectionError(autoConnectResult.error)
        ? 'cancelled'
        : 'auto-connect-failed';

      await this.finalize(reason, false);

      return {
        configuration: undefined,
        error: autoConnectResult.error,
        isSuccessful: false,
        peerConnection: undefined,
        reason,
      };
    }

    this.stateMachine.send({ type: 'AUTO_CONNECTED' });
    this.subscribeToLifecycle();

    const config = this.connectionManager.getConnectionConfiguration();

    if (config === undefined) {
      const error = new Error('Connection configuration is unavailable after auto-connect');

      await this.finalize('auto-connect-failed', false);
      throw error;
    }

    try {
      this.isCallStartPending = true;

      const peerConnection = await startCall();

      this.isCallStartPending = false;

      if (this.hasFinalizationStarted()) {
        return await this.createInterruptedStartResult();
      }

      this.stateMachine.send({ type: 'CALL_STARTED' });

      return {
        configuration: config,
        isSuccessful: true,
        peerConnection,
      };
    } catch (error) {
      this.isCallStartPending = false;

      if (this.hasFinalizationStarted()) {
        return this.createInterruptedStartResult(error);
      }

      await this.finalize('initial-call-failed', true).catch((cleanupError: unknown) => {
        debug('cleanup after initial call failure failed', cleanupError);
      });

      throw error;
    }
  };

  public hangUp = async (): Promise<void> => {
    return this.finalize('manual', true, true);
  };

  public disconnect = async (): Promise<void> => {
    return this.finalize('manual', true, true);
  };

  public waitUntilClosed = async (): Promise<TConnectAndCallSessionCloseReason> => {
    return this.closedPromise;
  };

  private subscribeToLifecycle(): void {
    this.unsubscribes.push(
      this.callReconnectManager.on('termination-classified', ({ decision }) => {
        if (decision === 'redial') {
          this.stateMachine.send({ type: 'REDIAL_STARTED' });

          return;
        }

        this.finalizeInBackground('completed', false);
      }),
      this.callReconnectManager.on('attempt-succeeded', () => {
        this.stateMachine.send({ type: 'REDIAL_SUCCEEDED' });
      }),
      this.callReconnectManager.on('terminal', () => {
        this.finalizeInBackground('redial-exhausted', false);
      }),
      this.autoConnectorManager.on('failed-all-attempts', () => {
        this.finalizeInBackground('auto-connect-failed', true);
      }),
      this.autoConnectorManager.on('stop-attempts-by-error', () => {
        this.finalizeInBackground('auto-connect-failed', true);
      }),
      this.autoConnectorManager.on('limit-reached-attempts', () => {
        this.finalizeInBackground('auto-connect-failed', true);
      }),
      this.autoConnectorManager.stateMachine.onStateChange(() => {
        if (
          !this.autoConnectorManager.isActive &&
          (this.phase === EConnectAndCallSessionPhase.CALLING ||
            this.phase === EConnectAndCallSessionPhase.ACTIVE ||
            this.phase === EConnectAndCallSessionPhase.RECONNECTING)
        ) {
          this.finalizeInBackground('auto-connect-failed', true);
        }
      }),
    );
  }

  private finalizeInBackground(
    reason: TConnectAndCallSessionCloseReason,
    shouldHangUp: boolean,
  ): void {
    this.finalize(reason, shouldHangUp).catch((error: unknown) => {
      debug('background finalization failed', error);
    });
  }

  private hasFinalizationStarted(): boolean {
    return this.finalizePromise !== undefined;
  }

  private async createInterruptedStartResult(
    startError?: unknown,
  ): Promise<Extract<TConnectAndCallSessionStartResult, { isSuccessful: false }>> {
    let cleanupError: unknown;

    try {
      await this.finalizePromise;
    } catch (error) {
      cleanupError = error;
    }

    return {
      configuration: undefined,
      error: cleanupError ?? startError,
      isSuccessful: false,
      peerConnection: undefined,
      reason: this.finalizationReason === 'manual' ? 'cancelled' : 'auto-connect-failed',
    };
  }

  private async finalize(
    reason: TConnectAndCallSessionCloseReason,
    shouldHangUp: boolean,
    isManual = false,
  ): Promise<void> {
    if (this.finalizePromise !== undefined) {
      return this.finalizePromise;
    }

    this.finalizationReason = reason;
    this.stateMachine.send(isManual ? { type: 'MANUAL_CLOSE' } : { type: 'FINALIZE', reason });

    this.finalizePromise = (async () => {
      try {
        this.callReconnectManager.disarm(isManual ? 'manual' : 'disarm');
        this.callReconnectManager.cancelCurrentAttempt();

        if (shouldHangUp && (this.isCallStartPending || this.teardown.isCallOngoing())) {
          await this.teardown.endCall();
        }
      } finally {
        await this.autoConnectorManager.stop();
      }
    })().finally(() => {
      this.unsubscribes.splice(0).forEach((unsubscribe) => {
        unsubscribe();
      });
      this.stateMachine.send({ type: 'CLEANUP_COMPLETE' });
      this.resolveClosed(reason);
    });

    return this.finalizePromise;
  }
}

export default ConnectAndCallSessionManager;
