import { CancelableRequest } from '@krivega/cancelable-promise';
import { DelayRequester } from '@krivega/timeout-requester';
import { EventEmitterProxy } from 'events-constructor';

import logger from '@/logger';
import AttemptsState from './AttemptsState';
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
import type {
  IAutoConnectorOptions,
  TNetworkInterfacesSubscriber,
  TParametersAutoConnect,
  TReconnectReason,
  TResumeFromSleepModeSubscriber,
} from './types';

const DEFAULT_TIMEOUT_BETWEEN_ATTEMPTS = 3000;
const DEFAULT_CHECK_TELEPHONY_REQUEST_INTERVAL = 15_000;
const RECONNECT_COALESCE_WINDOW_MS = 250;

const ERROR_MESSAGES = {
  LIMIT_REACHED: 'Limit reached',
} as const;

const asyncNoop = async (): Promise<void> => {};

const defaultCanRetryOnError = (_error: unknown): boolean => {
  return true;
};

class AutoConnectorManager extends EventEmitterProxy<TEventMap> {
  public readonly stateMachine: AutoConnectorStateMachine;

  private readonly connectionManager: ConnectionManager;

  private readonly connectionQueueManager: ConnectionQueueManager;

  private readonly checkTelephonyRequester: CheckTelephonyRequester;

  private readonly pingServerIfNotActiveCallRequester: PingServerIfNotActiveCallRequester;

  private readonly registrationFailedOutOfCallSubscriber: RegistrationFailedOutOfCallSubscriber;

  private readonly attemptsState: AttemptsState;

  private readonly delayBetweenAttempts: DelayRequester;

  private readonly cancelableRequestBeforeRetry: CancelableRequest<void, void>;

  private readonly onBeforeRetry: () => Promise<void>;

  private readonly canRetryOnError: (error: unknown) => boolean;

  private readonly networkInterfacesSubscriber: TNetworkInterfacesSubscriber | undefined;

  private readonly resumeFromSleepModeSubscriber: TResumeFromSleepModeSubscriber | undefined;

  private readonly notActiveCallSubscriber: NotActiveCallSubscriber;

  private readonly reconnectCoalescer = new ReconnectRequestCoalescer({
    coalesceWindowMs: RECONNECT_COALESCE_WINDOW_MS,
  });

  private readonly telephonyFailPolicy: TelephonyFailPolicy;

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

    const onBeforeRetry = options?.onBeforeRetry ?? asyncNoop;
    const canRetryOnError = options?.canRetryOnError ?? defaultCanRetryOnError;

    this.connectionQueueManager = connectionQueueManager;
    this.connectionManager = connectionManager;
    this.onBeforeRetry = onBeforeRetry;
    this.canRetryOnError = canRetryOnError;
    this.networkInterfacesSubscriber = options?.networkInterfacesSubscriber;
    this.resumeFromSleepModeSubscriber = options?.resumeFromSleepModeSubscriber;

    this.checkTelephonyRequester = new CheckTelephonyRequester({
      connectionManager,
      interval: options?.checkTelephonyRequestInterval ?? DEFAULT_CHECK_TELEPHONY_REQUEST_INTERVAL,
    });
    this.pingServerIfNotActiveCallRequester = new PingServerIfNotActiveCallRequester({
      connectionManager,
      callManager,
    });
    this.registrationFailedOutOfCallSubscriber = new RegistrationFailedOutOfCallSubscriber({
      connectionManager,
      callManager,
    });
    this.attemptsState = new AttemptsState({
      onStatusChange: this.emitStatusChange,
    });
    this.cancelableRequestBeforeRetry = new CancelableRequest(onBeforeRetry);
    this.delayBetweenAttempts = new DelayRequester(
      options?.timeoutBetweenAttempts ?? DEFAULT_TIMEOUT_BETWEEN_ATTEMPTS,
    );
    this.notActiveCallSubscriber = new NotActiveCallSubscriber({ callManager });
    this.telephonyFailPolicy = new TelephonyFailPolicy(options?.telephonyFailPolicy);

    this.stateMachine = createAutoConnectorStateMachine(
      createMachineDeps({
        canRetryOnError: this.canRetryOnError,
        stopConnectionFlow: async () => {
          await this.stopConnectionFlow();
        },
        connect: async (parameters: TParametersAutoConnect) => {
          await this.connectionQueueManager.connect(parameters.getParameters, parameters.options);
        },
        delayBetweenAttempts: async () => {
          await this.delayBetweenAttempts.request();
        },
        onBeforeRetryRequest: async () => {
          await this.cancelableRequestBeforeRetry.request();
        },
        hasLimitReached: () => {
          return this.attemptsState.hasLimitReached();
        },
        emitBeforeAttempt: () => {
          this.events.trigger('before-attempt', {});
        },
        stopConnectTriggers: () => {
          this.stopConnectTriggers();
        },
        startAttempt: () => {
          this.attemptsState.startAttempt();
        },
        incrementAttempt: () => {
          this.attemptsState.increment();
        },
        finishAttempt: () => {
          this.attemptsState.finishAttempt();
        },
        emitLimitReachedAttempts: () => {
          this.events.trigger('limit-reached-attempts', new Error(ERROR_MESSAGES.LIMIT_REACHED));
        },
        getParametersFromContext: () => {
          return this.stateMachine.context.parameters;
        },
        startCheckTelephony: (parameters: TParametersAutoConnect) => {
          this.startCheckTelephony(parameters);
        },
        subscribeToConnectTriggers: (parameters: TParametersAutoConnect) => {
          this.subscribeToConnectTriggers(parameters);
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
    this.unsubscribeFromHardwareTriggers();
    this.resetReconnectCoalescingState();
    this.stateMachine.toStop();
  }

  // Test hook: allows deterministic cancellation of pending retry flow.
  public cancelPendingRetry() {
    this.delayBetweenAttempts.cancelRequest();
    this.cancelableRequestBeforeRetry.cancelRequest();
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

  private async stopConnectionFlow() {
    logger('stopConnectionFlow');

    this.stopAttempts();
    this.stopConnectTriggers();
    await this.connectionQueueManager.disconnect();
  }

  private stopAttempts() {
    if (this.attemptsState.isAttemptInProgress) {
      this.connectionQueueManager.stop();
    }

    this.cancelPendingRetry();
    this.attemptsState.reset();
  }

  private stopConnectTriggers() {
    logger('stopConnectTriggers');

    this.stopPingRequester();
    this.checkTelephonyRequester.stop();
    this.registrationFailedOutOfCallSubscriber.unsubscribe();
  }

  private startCheckTelephony(parameters: TParametersAutoConnect) {
    logger('startCheckTelephony');

    this.checkTelephonyRequester.start({
      onBeforeRequest: async () => {
        await this.onBeforeRetry();

        return parameters.getParameters();
      },
      onSuccessRequest: () => {
        logger('startCheckTelephony: onSuccessRequest');
        this.telephonyFailPolicy.reset();

        const isUnavailable = this.isConnectionUnavailable();

        logger('connectIfDisconnected: isUnavailable', isUnavailable);

        if (isUnavailable) {
          this.requestReconnect(parameters, 'telephony-disconnected');
        } else {
          this.stateMachine.toTelephonyResultStillConnected();
        }
      },
      onFailRequest: (error?: unknown) => {
        const decision = this.telephonyFailPolicy.registerFailure();

        this.events.trigger('telephony-check-failure', {
          failCount: decision.failCount,
          escalationLevel: decision.escalationLevel,
          shouldRequestReconnect: decision.shouldRequestReconnect,
          nextRetryDelayMs: decision.nextRetryDelayMs,
          error,
        });

        if (decision.escalationLevel !== 'none' && decision.hasEscalated) {
          this.events.trigger('telephony-check-escalated', {
            failCount: decision.failCount,
            escalationLevel: decision.escalationLevel,
            error,
          });
        }

        if (decision.shouldRequestReconnect) {
          this.requestReconnect(parameters, 'telephony-check-failed');
        }

        logger('startCheckTelephony: onFailRequest', (error as Error).message);
      },
    });
  }

  private subscribeToConnectTriggers(parameters: TParametersAutoConnect) {
    this.startPingRequester(parameters);

    this.registrationFailedOutOfCallSubscriber.subscribe(() => {
      logger('registrationFailedOutOfCallListener callback');

      this.requestReconnect(parameters, 'registration-failed-out-of-call');
    });
  }

  private subscribeToNotActiveCall(parameters: TParametersAutoConnect) {
    this.notActiveCallSubscriber.subscribe({
      onActive: () => {
        logger('subscribeToNotActiveCall onActive');
        this.unsubscribeFromHardwareTriggers();
      },
      onInactive: () => {
        logger('subscribeToNotActiveCall onInactive');
        this.subscribeToHardwareTriggers(parameters);
      },
    });
  }

  private unsubscribeFromNotActiveCall() {
    this.notActiveCallSubscriber.unsubscribe();
  }

  private subscribeToHardwareTriggers(parameters: TParametersAutoConnect) {
    this.unsubscribeFromHardwareTriggers();

    logger('subscribeToHardwareTriggers');

    this.networkInterfacesSubscriber?.subscribe({
      onChange: () => {
        logger('networkInterfacesSubscriber onChange');

        this.requestReconnect(parameters, 'network-change');
      },
      onUnavailable: () => {
        logger('networkInterfacesSubscriber onUnavailable');

        this.stateMachine.toStop();
      },
    });

    this.resumeFromSleepModeSubscriber?.subscribe({
      onResume: () => {
        logger('resumeFromSleepModeSubscriber onResume');

        this.requestReconnect(parameters, 'sleep-resume');
      },
    });
  }

  private unsubscribeFromHardwareTriggers() {
    logger('unsubscribeFromHardwareTriggers');

    this.networkInterfacesSubscriber?.unsubscribe();
    this.resumeFromSleepModeSubscriber?.unsubscribe();
  }

  private stopPingRequester() {
    this.pingServerIfNotActiveCallRequester.stop();
  }

  private startPingRequester(_parameters: TParametersAutoConnect) {
    this.pingServerIfNotActiveCallRequester.start({
      onFailRequest: () => {
        logger('pingRequester: onFailRequest');

        this.stateMachine.toFlowRestart();
      },
    });
  }

  private isConnectionUnavailable() {
    const { isDisconnected, isIdle } = this.connectionManager;

    return isDisconnected || isIdle;
  }

  private readonly emitStatusChange = ({ isInProgress }: { isInProgress: boolean }) => {
    this.events.trigger('changed-attempt-status', { isInProgress });
  };
}

export default AutoConnectorManager;
