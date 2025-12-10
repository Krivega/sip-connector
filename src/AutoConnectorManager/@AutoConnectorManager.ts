import { CancelableRequest, isCanceledError } from '@krivega/cancelable-promise';
import { DelayRequester, hasCanceledError } from '@krivega/timeout-requester';
import { TypedEvents } from 'events-constructor';

import {
  DEFAULT_CONNECTION_RECOVERY_MAX_INTERVAL,
  hasNotReadyForConnectionError,
} from '@/ConnectionManager';
import { hasConnectionPromiseIsNotActualError } from '@/ConnectionQueueManager';
import logger from '@/logger';
import AttemptsState from './AttemptsState';
import CheckTelephonyRequester from './CheckTelephonyRequester';
import { EEvent, EVENT_NAMES } from './eventNames';
import RegistrationFailedOutOfCallSubscriber from './RegistrationFailedOutOfCallSubscriber';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { ConnectionQueueManager } from '@/ConnectionQueueManager';
import type { TEventMap, TEvents } from './eventNames';
import type {
  IAutoConnectorOptions,
  TNetworkInterfacesSubscriber,
  TParametersAutoConnect,
  TResumeFromSleepModeSubscriber,
} from './types';

const DEFAULT_TIMEOUT_BETWEEN_ATTEMPTS = 3000;
const DEFAULT_CHECK_TELEPHONY_REQUEST_INTERVAL = 15_000;
const MILLISECONDS_IN_SECOND = 1000;

const ERROR_MESSAGES = {
  LIMIT_REACHED: 'Limit reached',
  FAILED_TO_RECONNECT: 'Failed to reconnect',
} as const;

const asyncNoop = async (): Promise<void> => {};

const defaultCanRetryOnError = (_error: unknown): boolean => {
  return true;
};

class AutoConnectorManager {
  public readonly events: TEvents;

  private readonly connectionManager: ConnectionManager;

  private readonly connectionQueueManager: ConnectionQueueManager;

  private readonly checkTelephonyRequester: CheckTelephonyRequester;

  private readonly registrationFailedOutOfCallSubscriber: RegistrationFailedOutOfCallSubscriber;

  private readonly attemptsState: AttemptsState;

  private readonly delayBetweenAttempts: DelayRequester;

  private readonly cancelableRequestBeforeRetry: CancelableRequest<void, void>;

  private readonly onBeforeRetry: () => Promise<void>;

  private readonly canRetryOnError: (error: unknown) => boolean;

  private readonly networkInterfacesSubscriber: TNetworkInterfacesSubscriber | undefined;

  private readonly resumeFromSleepModeSubscriber: TResumeFromSleepModeSubscriber | undefined;

  private readonly defaultConnectionRecoveryMaxInterval = DEFAULT_CONNECTION_RECOVERY_MAX_INTERVAL;

  private disconnectedHandler: (() => void) | undefined;

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
    const onBeforeRetry = options?.onBeforeRetry ?? asyncNoop;
    const canRetryOnError = options?.canRetryOnError ?? defaultCanRetryOnError;

    this.connectionQueueManager = connectionQueueManager;
    this.connectionManager = connectionManager;
    this.onBeforeRetry = onBeforeRetry;
    this.canRetryOnError = canRetryOnError;
    this.networkInterfacesSubscriber = options?.networkInterfacesSubscriber;
    this.resumeFromSleepModeSubscriber = options?.resumeFromSleepModeSubscriber;

    this.events = new TypedEvents<TEventMap>(EVENT_NAMES);
    this.checkTelephonyRequester = new CheckTelephonyRequester({
      connectionManager,
      interval: options?.checkTelephonyRequestInterval ?? DEFAULT_CHECK_TELEPHONY_REQUEST_INTERVAL,
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
  }

  public start(parameters: TParametersAutoConnect) {
    logger('auto connector start');

    this.restartConnectionAttempts(parameters);
    this.subscribeToHardwareTriggers(parameters);
  }

  public stop() {
    logger('auto connector stop');

    this.unsubscribeFromHardwareTriggers();
    this.stopConnectionFlow();
  }

  public on<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.events.on(eventName, handler);
  }

  public once<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.events.once(eventName, handler);
  }

  public onceRace<T extends keyof TEventMap>(
    eventNames: T[],
    handler: (data: TEventMap[T], eventName: string) => void,
  ) {
    return this.events.onceRace(eventNames, handler);
  }

  public async wait<T extends keyof TEventMap>(eventName: T): Promise<TEventMap[T]> {
    return this.events.wait(eventName);
  }

  public off<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    this.events.off(eventName, handler);
  }

  private restartConnectionAttempts(parameters: TParametersAutoConnect) {
    logger('auto connector restart connection attempts');

    this.stopConnectionFlow();
    this.attemptConnection(parameters).catch((error: unknown) => {
      logger('auto connector failed to connect:', error);
    });
  }

  private stopConnectionFlow() {
    logger('stopConnectionFlow');

    this.stopAttempts();
    this.stopConnectTriggers();
    this.connectionQueueManager.disconnect().catch((error: unknown) => {
      logger('auto connector disconnect: error', error);
    });
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

    this.checkTelephonyRequester.stop();
    this.registrationFailedOutOfCallSubscriber.unsubscribe();
    this.unsubscribeFromDisconnected();
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

        this.connectIfDisconnected(parameters);
      },
      onFailRequest: (error?: unknown) => {
        logger('startCheckTelephony: onFailRequest', (error as Error).message);
      },
    });
  }

  private async attemptConnection(parameters: TParametersAutoConnect) {
    logger('attemptConnection: attempts.count', this.attemptsState.count);

    this.events.trigger(EEvent.BEFORE_ATTEMPT, {});
    this.stopConnectTriggers();

    if (this.attemptsState.hasLimitReached()) {
      logger('attemptConnection: limit reached');

      this.handleLimitReached(parameters);

      return;
    }

    this.attemptsState.startAttempt();
    this.attemptsState.increment();

    return this.executeConnectionAttempt(parameters);
  }

  private async executeConnectionAttempt(parameters: TParametersAutoConnect) {
    try {
      await this.connectionQueueManager.connect(parameters.getParameters, parameters.options);

      logger('executeConnectionAttempt: success');

      this.handleSucceededAttempt(parameters);
    } catch (error) {
      this.handleConnectionError(error, parameters);
    }
  }

  private handleConnectionError(error: unknown, parameters: TParametersAutoConnect) {
    if (hasNotReadyForConnectionError(error)) {
      this.attemptsState.finishAttempt();
      this.handleSucceededAttempt(parameters);

      return;
    }

    if (!this.canRetryOnError(error)) {
      logger('executeConnectionAttempt: error does not allow retry', error);

      this.attemptsState.finishAttempt();
      this.events.trigger(EEvent.STOP_ATTEMPTS_BY_ERROR, error);

      return;
    }

    if (hasConnectionPromiseIsNotActualError(error)) {
      logger('executeConnectionAttempt: not actual error', error);

      this.attemptsState.finishAttempt();
      this.events.trigger(EEvent.CANCELLED_ATTEMPTS, error);

      return;
    }

    logger('executeConnectionAttempt: error', error);

    this.scheduleReconnect(parameters);
  }

  private handleLimitReached(parameters: TParametersAutoConnect) {
    this.attemptsState.finishAttempt();

    this.events.trigger(EEvent.LIMIT_REACHED_ATTEMPTS, new Error(ERROR_MESSAGES.LIMIT_REACHED));

    this.startCheckTelephony(parameters);
  }

  private handleSucceededAttempt(parameters: TParametersAutoConnect) {
    logger('handleSucceededAttempt');

    this.subscribeToConnectTriggers(parameters);

    this.events.trigger(EEvent.SUCCESS);
  }

  private subscribeToConnectTriggers(parameters: TParametersAutoConnect) {
    this.unsubscribeFromDisconnected();

    this.disconnectedHandler = () => {
      logger('subscribeToConnectTriggers: disconnected event received');

      this.handleDisconnected(parameters).catch((error: unknown) => {
        logger('handleDisconnected: error', error);
      });
    };

    this.connectionManager.on('disconnected', this.disconnectedHandler);

    this.registrationFailedOutOfCallSubscriber.subscribe(() => {
      logger('registrationFailedOutOfCallListener callback');

      this.restartConnectionAttempts(parameters);
    });
  }

  private async handleDisconnected(parameters: TParametersAutoConnect) {
    logger('handleDisconnected: waiting for connected or timeout');

    const connectedPromise = this.getConnectedPromise();

    const connectionRecoveryTimeoutPromise = this.getConnectionRecoveryTimeoutPromise(parameters);

    const result = await Promise.race([connectedPromise, connectionRecoveryTimeoutPromise]);

    if (result === 'timeout') {
      logger('handleDisconnected: restarting connection attempts due to timeout');

      this.restartConnectionAttempts(parameters);
    } else {
      logger('handleDisconnected: connected before connection timeout');
    }
  }

  private async getConnectedPromise() {
    return this.connectionManager.wait('connected').then(() => {
      logger('getConnectedPromise: connected event received');

      return 'connected' as const;
    });
  }

  private async getConnectionRecoveryTimeoutPromise(parameters: TParametersAutoConnect) {
    const connectionRecoveryTimeout = await this.getConnectionRecoveryTimeout(parameters);

    return new Promise<'timeout'>((resolve) => {
      setTimeout(() => {
        logger('getTimeoutPromise: timeout reached');

        resolve('timeout' as const);
      }, connectionRecoveryTimeout);
    });
  }

  private async getConnectionRecoveryTimeout(parameters: TParametersAutoConnect) {
    const { connectionRecoveryMaxInterval = this.defaultConnectionRecoveryMaxInterval } =
      await parameters.getParameters();

    const recoveryTimeout = connectionRecoveryMaxInterval * MILLISECONDS_IN_SECOND;

    logger(`getConnectionRecoveryTimeout: calculated timeout ${recoveryTimeout}ms`);

    return recoveryTimeout;
  }

  private unsubscribeFromDisconnected() {
    if (this.disconnectedHandler) {
      this.connectionManager.off('disconnected', this.disconnectedHandler);
      this.disconnectedHandler = undefined;
    }
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

        this.stopConnectionFlow();
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

  private connectIfDisconnected(parameters: TParametersAutoConnect) {
    const isUnavailable = this.isConnectionUnavailable();

    logger('connectIfDisconnected: isUnavailable', isUnavailable);

    if (isUnavailable) {
      this.restartConnectionAttempts(parameters);
    } else {
      this.stopConnectTriggers();
      this.events.trigger(EEvent.SUCCESS);
    }
  }

  private scheduleReconnect(parameters: TParametersAutoConnect) {
    logger('scheduleReconnect');

    this.delayBetweenAttempts
      .request()
      .then(async () => {
        logger('scheduleReconnect: delayBetweenAttempts success');

        return this.cancelableRequestBeforeRetry.request();
      })
      .then(async () => {
        logger('scheduleReconnect: onBeforeRetry success');

        return this.attemptConnection(parameters);
      })
      .catch((error: unknown) => {
        const reconnectError =
          error instanceof Error ? error : new Error(ERROR_MESSAGES.FAILED_TO_RECONNECT);

        this.attemptsState.finishAttempt();

        if (isCanceledError(error) || hasCanceledError(error as Error)) {
          this.events.trigger(EEvent.CANCELLED_ATTEMPTS, reconnectError);
        } else {
          this.events.trigger(EEvent.FAILED_ALL_ATTEMPTS, reconnectError);
        }

        logger('scheduleReconnect: error', error);
      });
  }

  private isConnectionUnavailable() {
    const { isFailed, isDisconnected, isIdle } = this.connectionManager;

    return isFailed || isDisconnected || isIdle;
  }

  private readonly emitStatusChange = ({ isInProgress }: { isInProgress: boolean }) => {
    this.events.trigger(EEvent.CHANGED_ATTEMPT_STATUS, { isInProgress });
  };
}

export default AutoConnectorManager;
