import { EventEmitterProxy } from 'events-constructor';

import resolveDebug from '@/logger';
import { AutoConnectorRuntime } from './AutoConnectorRuntime';
import { createAutoConnectorStateMachine } from './AutoConnectorStateMachine';
import { createMachineDeps } from './createMachineDeps';
import { createEvents } from './events';
import ReconnectRequestCoalescer from './ReconnectRequestCoalescer';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { ConnectionQueueManager } from '@/ConnectionQueueManager';
import type { AutoConnectorStateMachine } from './AutoConnectorStateMachine';
import type { TEventMap } from './events';
import type { IAutoConnectorOptions, TParametersAutoConnect, TReconnectReason } from './types';

const RECONNECT_COALESCE_WINDOW_MS = 250;

const ERROR_MESSAGES = {
  LIMIT_REACHED: 'Limit reached',
} as const;

const defaultCanRetryOnError = (_error: unknown): boolean => {
  return true;
};

const debug = resolveDebug('AutoConnectorManager');

class AutoConnectorManager extends EventEmitterProxy<TEventMap> {
  public readonly stateMachine: AutoConnectorStateMachine;

  private readonly runtime: AutoConnectorRuntime;

  private readonly reconnectCoalescer = new ReconnectRequestCoalescer({
    coalesceWindowMs: RECONNECT_COALESCE_WINDOW_MS,
  });

  public constructor(
    {
      connectionQueueManager,
      connectionManager,
      callManager,
    }: {
      connectionQueueManager: ConnectionQueueManager;
      connectionManager: ConnectionManager;
      callManager: CallManager;
    },
    options?: IAutoConnectorOptions,
  ) {
    super(createEvents());

    this.runtime = new AutoConnectorRuntime({
      connectionManager,
      connectionQueueManager,
      callManager,
      options,
      emitters: {
        emitBeforeAttempt: () => {
          this.events.trigger('before-attempt', {});
        },
        emitLimitReachedAttempts: () => {
          this.events.trigger('limit-reached-attempts', new Error(ERROR_MESSAGES.LIMIT_REACHED));
        },
        emitSuccess: () => {
          debug('handleSucceededAttempt');
          this.events.trigger('success');
        },
        emitStopAttemptsByError: (error: unknown) => {
          this.events.trigger('stop-attempts-by-error', error);
        },
        emitCancelledAttempts: (error: unknown) => {
          this.events.trigger('cancelled-attempts', error);
        },
        emitFailedAllAttempts: (error: Error) => {
          this.events.trigger('failed-all-attempts', error);
        },
        emitTelephonyCheckFailure: (payload) => {
          this.events.trigger('telephony-check-failure', payload);
        },
        emitTelephonyCheckEscalated: (payload) => {
          this.events.trigger('telephony-check-escalated', payload);
        },
        emitStatusChange: ({ isInProgress }: { isInProgress: boolean }) => {
          this.events.trigger('changed-attempt-status', { isInProgress });
        },
      },
      reconnectActions: {
        requestReconnect: this.requestReconnect,
        requestFlowRestart: () => {
          this.stateMachine.toFlowRestart();
        },
        notifyTelephonyStillConnected: () => {
          this.stateMachine.toTelephonyResultStillConnected();
        },
      },
    });

    this.stateMachine = createAutoConnectorStateMachine(
      createMachineDeps({
        runtime: this.runtime,
        canRetryOnError: options?.canRetryOnError ?? defaultCanRetryOnError,
      }),
    );
  }

  public start(parameters: TParametersAutoConnect) {
    debug('auto connector start');

    this.requestReconnect(parameters, 'start');
  }

  public stop() {
    debug('auto connector stop');

    this.resetReconnectCoalescingState();
    this.stateMachine.toStop();
  }

  // Test hook: allows deterministic cancellation of pending retry flow.
  public cancelPendingRetry() {
    this.runtime.cancelPendingRetry();
  }

  private readonly requestReconnect = (
    parameters: TParametersAutoConnect,
    reason: TReconnectReason,
  ) => {
    const isAvailableToRestart = this.shouldRequestReconnect(reason);

    debug('auto connector requestReconnect', {
      isAvailableToRestart,
      reason,
    });

    if (!isAvailableToRestart) {
      return;
    }

    this.stateMachine.toRestart(parameters);
  };

  private shouldRequestReconnect(reason: TReconnectReason) {
    const decision = this.reconnectCoalescer.register(reason);

    if (!decision.shouldRequest) {
      debug(`auto connector reconnect coalesced: ${reason}`, {
        state: String(this.stateMachine.state),
        coalescedBy: decision.coalescedBy,
        currentPriority: decision.currentPriority,
        coalescedByPriority: decision.coalescedByPriority,
      });

      return false;
    }

    debug(`auto connector reconnect requested: ${reason}`, {
      state: String(this.stateMachine.state),
      generation: decision.generation,
    });

    return true;
  }

  private resetReconnectCoalescingState() {
    this.reconnectCoalescer.reset();
  }
}

export default AutoConnectorManager;
