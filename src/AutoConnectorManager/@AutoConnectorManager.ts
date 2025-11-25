import { CancelableRequest, isCanceledError } from '@krivega/cancelable-promise';
import { DelayRequester, hasCanceledError } from '@krivega/timeout-requester';
import { TypedEvents } from 'events-constructor';

import { hasNotReadyForConnectionError } from '@/ConnectionManager';
import { hasConnectionPromiseIsNotActualError } from '@/ConnectionQueueManager';
import logger from '@/logger';
import AttemptsState from './AttemptsState';
import CheckTelephonyRequester from './CheckTelephonyRequester';
import { EEvent, EVENT_NAMES } from './eventNames';
import PingServerIfNotActiveCallRequester from './PingServerIfNotActiveCallRequester';
import RegistrationFailedOutOfCallSubscriber from './RegistrationFailedOutOfCallSubscriber';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { ConnectionQueueManager } from '@/ConnectionQueueManager';
import type { TEventMap, TEvents } from './eventNames';
import type {
  IAutoConnectorOptions,
  TNetworkInterfacesSubscriber,
  TParametersAutoConnect,
  TResumeSubscriber,
} from './types';

const DEFAULT_TIMEOUT_BETWEEN_ATTEMPTS = 3000;
const DEFAULT_CHECK_TELEPHONY_REQUEST_INTERVAL = 15_000;

const asyncNoop = async (): Promise<void> => {};

const defaultCanRetryOnError = (_error: unknown): boolean => {
  return true;
};

class AutoConnectorManager {
  public readonly events: TEvents;

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

  private readonly resumeSubscriber: TResumeSubscriber | undefined;

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
    this.resumeSubscriber = options?.resumeSubscriber;

    this.events = new TypedEvents<TEventMap>(EVENT_NAMES);
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
  }

  public start(parameters: TParametersAutoConnect) {
    logger('auto connector start');

    this.stop();
    this.connect(parameters).catch((error: unknown) => {
      logger('auto connector failed to connect:', error);
    });
  }

  public stop() {
    logger('auto connector stop');

    this.stopAttempts();
    this.stopConnectTriggers();

    this.connectionQueueManager.disconnect().catch((error: unknown) => {
      logger('auto connector disconnect: error', error);
    });
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

    this.stopPingServerIfNotActiveCallRequester();
    this.checkTelephonyRequester.stop();
    this.registrationFailedOutOfCallSubscriber.unsubscribe();
    this.networkInterfacesSubscriber?.unsubscribe();
    this.resumeSubscriber?.unsubscribe();
  }

  private runCheckTelephony(parameters: TParametersAutoConnect) {
    logger('runCheckTelephony');

    this.checkTelephonyRequester.start({
      onBeforeRequest: async () => {
        await this.onBeforeRetry();

        return parameters.getParameters();
      },
      onSuccessRequest: () => {
        logger('runCheckTelephony: onSuccessRequest');

        this.connectIfDisconnected(parameters);
      },
      onFailRequest: (error?: unknown) => {
        logger('runCheckTelephony: onFailRequest', (error as Error).message);
      },
    });
  }

  private async connect(parameters: TParametersAutoConnect) {
    logger('connect: attempts.count', this.attemptsState.count);

    this.events.trigger(EEvent.BEFORE_ATTEMPT, {});
    this.stopConnectTriggers();

    const isLimitReached = this.attemptsState.hasLimitReached();

    if (isLimitReached) {
      logger('connect: isLimitReached!');

      this.handleLimitReached(parameters);

      return;
    }

    this.attemptsState.startAttempt();
    this.attemptsState.increment();

    return this.processConnect(parameters);
  }

  private async processConnect(parameters: TParametersAutoConnect) {
    try {
      await this.connectionQueueManager.connect(parameters.getParameters, parameters.options);

      logger('processConnect success');

      this.handleSucceededAttempt(parameters);
    } catch (error) {
      if (hasNotReadyForConnectionError(error)) {
        this.attemptsState.finishAttempt();
        this.handleSucceededAttempt(parameters);

        return;
      }

      if (!this.canRetryOnError(error)) {
        logger('processConnect: error does not allow retry', error);

        this.attemptsState.finishAttempt();
        this.events.trigger(EEvent.STOP_ATTEMPTS_BY_ERROR, error);

        return;
      }

      if (hasConnectionPromiseIsNotActualError(error)) {
        logger('processConnect: not actual error', error);

        this.attemptsState.finishAttempt();
        this.events.trigger(EEvent.CANCELLED_ATTEMPTS, error);

        return;
      }

      logger('processConnect: error', error);

      this.reconnect(parameters);
    }
  }

  private handleLimitReached(parameters: TParametersAutoConnect) {
    this.attemptsState.finishAttempt();

    this.events.trigger(EEvent.LIMIT_REACHED_ATTEMPTS, new Error('Limit reached'));

    this.runCheckTelephony(parameters);
  }

  private handleSucceededAttempt(parameters: TParametersAutoConnect) {
    logger('handleSucceededAttempt');

    this.subscribeToConnectTriggers(parameters);

    this.events.trigger(EEvent.SUCCESS);
  }

  private subscribeToConnectTriggers(parameters: TParametersAutoConnect) {
    this.startPingServerIfNotActiveCallRequester(parameters);

    this.networkInterfacesSubscriber?.subscribe({
      onChange: () => {
        logger('networkInterfacesSubscriber onChange');

        this.restartPingServerIfNotActiveCallRequester(parameters);
      },
      onRemove: () => {
        logger('networkInterfacesSubscriber onRemove');

        this.stopPingServerIfNotActiveCallRequester();
      },
    });

    this.resumeSubscriber?.subscribe({
      onResume: () => {
        logger('resumeSubscriber onResume');

        this.restartPingServerIfNotActiveCallRequester(parameters);
      },
    });

    this.registrationFailedOutOfCallSubscriber.subscribe(() => {
      logger('registrationFailedOutOfCallListener callback');

      this.start(parameters);
    });
  }

  private restartPingServerIfNotActiveCallRequester(parameters: TParametersAutoConnect) {
    this.stopPingServerIfNotActiveCallRequester();
    this.startPingServerIfNotActiveCallRequester(parameters);
  }

  private stopPingServerIfNotActiveCallRequester() {
    this.pingServerIfNotActiveCallRequester.stop();
  }

  private startPingServerIfNotActiveCallRequester(parameters: TParametersAutoConnect) {
    this.pingServerIfNotActiveCallRequester.start({
      onFailRequest: () => {
        logger('pingServer onFailRequest');

        this.start(parameters);
      },
    });
  }

  private connectIfDisconnected(parameters: TParametersAutoConnect) {
    const isFailedOrDisconnected = this.hasFailedOrDisconnectedConnection();

    logger('connectIfDisconnected: isFailedOrDisconnected', isFailedOrDisconnected);

    if (isFailedOrDisconnected) {
      this.start(parameters);
    } else {
      this.stopConnectTriggers();
      this.events.trigger(EEvent.SUCCESS);
    }
  }

  private reconnect(parameters: TParametersAutoConnect) {
    logger('reconnect');

    this.delayBetweenAttempts
      .request()
      .then(async () => {
        logger('reconnect: delayBetweenAttempts success');

        return this.cancelableRequestBeforeRetry.request();
      })
      .then(async () => {
        logger('reconnect: onBeforeRetry success');

        return this.connect(parameters);
      })
      .catch((error: unknown) => {
        const reconnectError = error instanceof Error ? error : new Error('Failed to reconnect');

        this.attemptsState.finishAttempt();

        if (isCanceledError(error) || hasCanceledError(error as Error)) {
          this.events.trigger(EEvent.CANCELLED_ATTEMPTS, reconnectError);
        } else {
          this.events.trigger(EEvent.FAILED_ALL_ATTEMPTS, reconnectError);
        }

        logger('reconnect: error', error);
      });
  }

  private hasFailedOrDisconnectedConnection() {
    const { isFailed, isDisconnected, isIdle } = this.connectionManager;

    return isFailed || isDisconnected || isIdle;
  }

  private readonly emitStatusChange = ({ isInProgress }: { isInProgress: boolean }) => {
    this.events.trigger(EEvent.CHANGED_ATTEMPT_STATUS, { isInProgress });
  };
}

export default AutoConnectorManager;
