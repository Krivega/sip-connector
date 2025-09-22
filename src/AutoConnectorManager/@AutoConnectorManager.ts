import { CancelableRequest, isCanceledError } from '@krivega/cancelable-promise';
import { DelayRequester, hasCanceledError } from '@krivega/timeout-requester';
import { TypedEvents } from 'events-constructor';

import { hasConnectionPromiseIsNotActualError } from '@/ConnectionQueueManager';
import logger from '@/logger';
import AttemptsState from './AttemptsState';
import CheckTelephonyRequester from './CheckTelephonyRequester';
import ConnectFlow from './ConnectFlow';
import { EEvent, EVENT_NAMES } from './eventNames';
import PingServerRequester from './PingServerRequester';
import RegistrationFailedOutOfCallSubscriber from './RegistrationFailedOutOfCallSubscriber';
import { createParametersNotExistError, hasParametersNotExistError } from './utils';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { ConnectionQueueManager } from '@/ConnectionQueueManager';
import type { TEventMap, TEvents } from './eventNames';
import type { IAutoConnectorOptions, TParametersAutoConnect } from './types';

const DEFAULT_TIMEOUT_BETWEEN_ATTEMPTS = 3000;
const DEFAULT_CHECK_TELEPHONY_REQUEST_INTERVAL = 15_000;

const asyncNoop = async (): Promise<void> => {};

class AutoConnectorManager {
  public readonly events: TEvents;

  private readonly connectionManager: ConnectionManager;

  private readonly connectFlow: ConnectFlow;

  private readonly checkTelephonyRequester: CheckTelephonyRequester;

  private readonly pingServerRequester: PingServerRequester;

  private readonly registrationFailedOutOfCallSubscriber: RegistrationFailedOutOfCallSubscriber;

  private readonly attemptsState: AttemptsState;

  private readonly delayBetweenAttempts: DelayRequester;

  private readonly cancelableRequestBeforeRetry: CancelableRequest<void, void>;

  private readonly onBeforeRetry: () => Promise<void>;

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

    this.connectionManager = connectionManager;
    this.onBeforeRetry = onBeforeRetry;

    this.events = new TypedEvents<TEventMap>(EVENT_NAMES);
    this.connectFlow = new ConnectFlow({
      connectionManager,
      connectionQueueManager,
      events: this.events,
    });
    this.checkTelephonyRequester = new CheckTelephonyRequester({
      connectionManager,
      interval: options?.checkTelephonyRequestInterval ?? DEFAULT_CHECK_TELEPHONY_REQUEST_INTERVAL,
    });
    this.pingServerRequester = new PingServerRequester({ connectionManager, callManager });
    this.registrationFailedOutOfCallSubscriber = new RegistrationFailedOutOfCallSubscriber({
      connectionManager,
      callManager,
    });
    this.attemptsState = new AttemptsState({
      events: this.events,
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

    this.connectFlow.runDisconnect().catch((error: unknown) => {
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
      this.connectFlow.stop();
    }

    this.delayBetweenAttempts.cancelRequest();
    this.cancelableRequestBeforeRetry.cancelRequest();
    this.attemptsState.reset();
  }

  private stopConnectTriggers() {
    logger('stopConnectTriggers');

    this.pingServerRequester.stop();
    this.checkTelephonyRequester.stop();
    this.registrationFailedOutOfCallSubscriber.unsubscribe();
  }

  private runCheckTelephony(parameters: TParametersAutoConnect) {
    logger('runCheckTelephony');

    this.checkTelephonyRequester.start({
      onBeforeRequest: async () => {
        await this.onBeforeRetry();

        return this.getParametersWithValidation(parameters.getParameters);
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
      await this.connectFlow.runConnect({
        onBeforeRequest: async () => {
          return this.getParametersWithValidation(parameters.getParameters);
        },
        hasReadyForConnection: parameters.hasReadyForConnection,
      });

      logger('processConnect success');

      this.subscribeToConnectTriggers(parameters);

      this.events.trigger(EEvent.SUCCEEDED_ATTEMPT, {});
    } catch (error) {
      if (hasParametersNotExistError(error)) {
        logger('processConnect: parameters not exist error', error);

        return;
      }

      if (hasConnectionPromiseIsNotActualError(error)) {
        logger('processConnect: not actual error', error);

        this.events.trigger(EEvent.CANCELLED_ATTEMPT, error as Error);

        return;
      }

      logger('processConnect: error', error);

      this.reconnect(parameters);
    }
  }

  private handleLimitReached(parameters: TParametersAutoConnect) {
    this.attemptsState.finishAttempt();

    this.events.trigger(EEvent.FAILED_ATTEMPT, new Error('Limit reached'));

    this.runCheckTelephony(parameters);
  }

  private subscribeToConnectTriggers(parameters: TParametersAutoConnect) {
    this.pingServerRequester.start({
      onFailRequest: () => {
        logger('pingServer onFailRequest');

        this.start(parameters);
      },
    });

    this.registrationFailedOutOfCallSubscriber.subscribe(() => {
      logger('registrationFailedOutOfCallListener callback');

      this.start(parameters);
    });
  }

  private connectIfDisconnected(parameters: TParametersAutoConnect) {
    const isFailedOrDisconnected = this.hasFailedOrDisconnectedConnection();

    logger('connectIfDisconnected: isFailedOrDisconnected', isFailedOrDisconnected);

    if (isFailedOrDisconnected) {
      this.start(parameters);
    } else {
      this.stopConnectTriggers();
      this.events.trigger(EEvent.SUCCEEDED_ATTEMPT, {});
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

        if (isCanceledError(error) || hasCanceledError(error as Error)) {
          this.events.trigger(EEvent.CANCELLED_ATTEMPT, reconnectError);
        } else {
          this.events.trigger(EEvent.FAILED_ATTEMPT, reconnectError);
        }

        logger('reconnect: error', error);
      });
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private async getParametersWithValidation(
    getParameters: TParametersAutoConnect['getParameters'],
  ) {
    return getParameters().then((data) => {
      if (!data) {
        throw createParametersNotExistError();
      }

      return data;
    });
  }

  private hasFailedOrDisconnectedConnection() {
    const { isFailed, isDisconnected } = this.connectionManager;

    return isFailed || isDisconnected;
  }
}

export default AutoConnectorManager;
