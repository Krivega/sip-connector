import { DelayRequester } from '@krivega/timeout-requester';
import { EventEmitterProxy } from 'events-constructor';

import logger from '@/logger';
import AttemptsState from './AttemptsState';
import { AutoConnectorRuntime } from './AutoConnectorRuntime';
import { createAutoConnectorStateMachine } from './AutoConnectorStateMachine';
import CheckTelephonyRequester from './CheckTelephonyRequester';
import { createMachineDeps } from './createMachineDeps';
import { createEvents } from './events';
import NotActiveCallSubscriber from './NotActiveCallSubscriber';
import PingServerIfNotActiveCallRequester from './PingServerIfNotActiveCallRequester';
import ReconnectRequestCoalescer from './ReconnectRequestCoalescer';
import RegistrationFailedOutOfCallSubscriber from './RegistrationFailedOutOfCallSubscriber';
import TelephonyFailPolicy from './TelephonyFailPolicy';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { ConnectionQueueManager } from '@/ConnectionQueueManager';
import type { AutoConnectorStateMachine } from './AutoConnectorStateMachine';
import type { TEventMap } from './events';
import type { IAutoConnectorOptions, TParametersAutoConnect, TReconnectReason } from './types';

const DEFAULT_TIMEOUT_BETWEEN_ATTEMPTS = 3000;
const DEFAULT_CHECK_TELEPHONY_REQUEST_INTERVAL = 15_000;
const RECONNECT_COALESCE_WINDOW_MS = 250;

const ERROR_MESSAGES = {
  LIMIT_REACHED: 'Limit reached',
} as const;

const defaultCanRetryOnError = (_error: unknown): boolean => {
  return true;
};

class AutoConnectorManager extends EventEmitterProxy<TEventMap> {
  public readonly stateMachine: AutoConnectorStateMachine;

  private readonly runtime: AutoConnectorRuntime;

  private readonly notActiveCallSubscriber: NotActiveCallSubscriber;

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

    const checkTelephonyRequester = new CheckTelephonyRequester({
      connectionManager,
      interval: options?.checkTelephonyRequestInterval ?? DEFAULT_CHECK_TELEPHONY_REQUEST_INTERVAL,
    });
    const pingServerIfNotActiveCallRequester = new PingServerIfNotActiveCallRequester({
      connectionManager,
      callManager,
    });
    const registrationFailedOutOfCallSubscriber = new RegistrationFailedOutOfCallSubscriber({
      connectionManager,
      callManager,
    });
    const attemptsState = new AttemptsState({
      onStatusChange: this.emitStatusChange,
    });
    const delayBetweenAttempts = new DelayRequester(
      options?.timeoutBetweenAttempts ?? DEFAULT_TIMEOUT_BETWEEN_ATTEMPTS,
    );

    this.notActiveCallSubscriber = new NotActiveCallSubscriber({ callManager });

    const telephonyFailPolicy = new TelephonyFailPolicy(options?.telephonyFailPolicy);

    this.runtime = new AutoConnectorRuntime({
      connectionManager,
      connectionQueueManager,
      checkTelephonyRequester,
      pingServerIfNotActiveCallRequester,
      registrationFailedOutOfCallSubscriber,
      attemptsState,
      delayBetweenAttempts,
      telephonyFailPolicy,
      networkInterfacesSubscriber: options?.networkInterfacesSubscriber,
      resumeFromSleepModeSubscriber: options?.resumeFromSleepModeSubscriber,
      emitters: {
        emitBeforeAttempt: () => {
          this.events.trigger('before-attempt', {});
        },
        emitLimitReachedAttempts: () => {
          this.events.trigger('limit-reached-attempts', new Error(ERROR_MESSAGES.LIMIT_REACHED));
        },
        emitSuccess: () => {
          logger('handleSucceededAttempt');
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
      },
      reconnectActions: {
        requestReconnect: (parameters: TParametersAutoConnect, reason: TReconnectReason) => {
          this.requestReconnect(parameters, reason);
        },
        requestFlowRestart: () => {
          this.stateMachine.toFlowRestart();
        },
        requestStop: () => {
          this.stateMachine.toStop();
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
    logger('auto connector start');

    this.requestReconnect(parameters, 'start');
    this.subscribeToNotActiveCall(parameters);
  }

  public stop() {
    logger('auto connector stop');

    this.unsubscribeFromNotActiveCall();
    this.runtime.unsubscribeFromHardwareTriggers();
    this.resetReconnectCoalescingState();
    this.stateMachine.toStop();
  }

  // Test hook: allows deterministic cancellation of pending retry flow.
  public cancelPendingRetry() {
    this.runtime.cancelPendingRetry();
  }

  private requestReconnect(parameters: TParametersAutoConnect, reason: TReconnectReason) {
    const decision = this.reconnectCoalescer.register(reason);

    if (!decision.shouldRequest) {
      logger(`auto connector reconnect coalesced: ${reason}`, {
        state: String(this.stateMachine.state),
        coalescedBy: decision.coalescedBy,
        currentPriority: decision.currentPriority,
        coalescedByPriority: decision.coalescedByPriority,
      });

      return;
    }

    logger(`auto connector reconnect requested: ${reason}`, {
      state: String(this.stateMachine.state),
      generation: decision.generation,
    });
    this.stateMachine.toRestart(parameters);
  }

  private resetReconnectCoalescingState() {
    this.reconnectCoalescer.reset();
  }

  private subscribeToNotActiveCall(parameters: TParametersAutoConnect) {
    this.notActiveCallSubscriber.subscribe({
      onActive: () => {
        logger('subscribeToNotActiveCall onActive');
        this.runtime.unsubscribeFromHardwareTriggers();
      },
      onInactive: () => {
        logger('subscribeToNotActiveCall onInactive');
        this.runtime.subscribeToHardwareTriggers(parameters);
      },
    });
  }

  private unsubscribeFromNotActiveCall() {
    this.notActiveCallSubscriber.unsubscribe();
  }

  private readonly emitStatusChange = ({ isInProgress }: { isInProgress: boolean }) => {
    this.events.trigger('changed-attempt-status', { isInProgress });
  };
}

export default AutoConnectorManager;
