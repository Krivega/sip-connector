import { CancelableRequest } from '@krivega/cancelable-promise';
import { DelayRequester } from '@krivega/timeout-requester';
import { EventEmitterProxy } from 'events-constructor';

import logger from '@/logger';
import AttemptsState from './AttemptsState';
import { createAutoConnectorStateMachine } from './AutoConnectorStateMachine';
import CheckTelephonyRequester from './CheckTelephonyRequester';
import { createEvents } from './events';
import NotActiveCallSubscriber from './NotActiveCallSubscriber';
import PingServerIfNotActiveCallRequester from './PingServerIfNotActiveCallRequester';
import RegistrationFailedOutOfCallSubscriber from './RegistrationFailedOutOfCallSubscriber';
import { wrapReconnectError } from './wrapReconnectError';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { ConnectionQueueManager } from '@/ConnectionQueueManager';
import type { AutoConnectorStateMachine } from './AutoConnectorStateMachine';
import type { TEventMap } from './events';
import type {
  IAutoConnectorOptions,
  TNetworkInterfacesSubscriber,
  TParametersAutoConnect,
  TResumeFromSleepModeSubscriber,
} from './types';

const DEFAULT_TIMEOUT_BETWEEN_ATTEMPTS = 3000;
const DEFAULT_CHECK_TELEPHONY_REQUEST_INTERVAL = 15_000;

const ERROR_MESSAGES = {
  LIMIT_REACHED: 'Limit reached',
  FAILED_TO_RECONNECT: 'Failed to reconnect',
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

    this.stateMachine = createAutoConnectorStateMachine(this.createMachineDeps());
  }

  public start(parameters: TParametersAutoConnect) {
    logger('auto connector start');

    this.restartConnectionAttempts(parameters);
    this.subscribeToNotActiveCall(parameters);
  }

  public stop() {
    logger('auto connector stop');

    this.unsubscribeFromNotActiveCall();
    this.unsubscribeFromHardwareTriggers();
    this.stateMachine.toStop();
  }

  private createMachineDeps() {
    return {
      canRetryOnError: (error: unknown) => {
        return this.canRetryOnError(error);
      },
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
      startCheckTelephony: () => {
        const { parameters } = this.stateMachine.context;

        // Контекст машины всегда содержит parameters перед этими шагами (assignRestart).
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- см. выше
        this.startCheckTelephony(parameters!);
      },
      onConnectSucceeded: () => {
        const { parameters } = this.stateMachine.context;

        logger('handleSucceededAttempt');

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- см. startCheckTelephony
        this.subscribeToConnectTriggers(parameters!);

        this.events.trigger('success');
      },
      onStopAttemptsByError: (error: unknown) => {
        this.events.trigger('stop-attempts-by-error', error);
      },
      emitCancelledAttemptsRaw: (error: unknown) => {
        this.events.trigger('cancelled-attempts', error);
      },
      emitCancelledAttemptsWrapped: (error: unknown) => {
        this.events.trigger('cancelled-attempts', wrapReconnectError(error));
      },
      onFailedAllAttempts: (error: unknown) => {
        this.events.trigger('failed-all-attempts', wrapReconnectError(error));
      },
      onTelephonyStillConnected: () => {
        logger('connectIfDisconnected: isUnavailable', false);

        this.stopConnectTriggers();
        this.events.trigger('success');
      },
    };
  }

  private restartConnectionAttempts(parameters: TParametersAutoConnect) {
    logger('auto connector restart connection attempts');

    this.stateMachine.toRestart(parameters);
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

    this.delayBetweenAttempts.cancelRequest();
    this.cancelableRequestBeforeRetry.cancelRequest();
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

        const isUnavailable = this.isConnectionUnavailable();

        logger('connectIfDisconnected: isUnavailable', isUnavailable);

        if (isUnavailable) {
          this.restartConnectionAttempts(parameters);
        } else {
          this.stateMachine.toTelephonyResultStillConnected();
        }
      },
      onFailRequest: (error?: unknown) => {
        logger('startCheckTelephony: onFailRequest', (error as Error).message);
      },
    });
  }

  private subscribeToConnectTriggers(parameters: TParametersAutoConnect) {
    this.startPingRequester(parameters);

    this.registrationFailedOutOfCallSubscriber.subscribe(() => {
      logger('registrationFailedOutOfCallListener callback');

      this.restartConnectionAttempts(parameters);
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

        this.restartConnectionAttempts(parameters);
      },
      onUnavailable: () => {
        logger('networkInterfacesSubscriber onUnavailable');

        this.stateMachine.toStop();
      },
    });

    this.resumeFromSleepModeSubscriber?.subscribe({
      onResume: () => {
        logger('resumeFromSleepModeSubscriber onResume');

        this.restartConnectionAttempts(parameters);
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
