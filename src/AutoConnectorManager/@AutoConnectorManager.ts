import { isCanceledError } from '@krivega/cancelable-promise';
import { DelayRequester, hasCanceledError } from '@krivega/timeout-requester';
import { TypedEvents } from 'events-constructor';

import { hasPromiseIsNotActualError } from '@/ConnectionQueueManager';
import logger from '@/logger';
import AttemptsState from './AttemptsState';
import CheckTelephonyRequester from './CheckTelephonyRequester';
import { EEvent, EVENT_NAMES } from './eventNames';
import PingServerRequester from './PingServerRequester';
import RegistrationFailedOutOfCallSubscriber from './RegistrationFailedOutOfCallSubscriber';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { ConnectionQueueManager } from '@/ConnectionQueueManager';
import type { TEventMap, TEvents } from './eventNames';
import type {
  IAutoConnectorOptions,
  ISubscriber,
  TErrorSipConnector,
  TParametersAutoConnect,
  TParametersConnect,
} from './types';

const DEFAULT_TIMEOUT_BETWEEN_ATTEMPTS = 3000;
const DEFAULT_CHECK_TELEPHONY_REQUEST_INTERVAL = 15_000;

class AutoConnectorManager {
  public readonly events: TEvents;

  private readonly connectionManager: ConnectionManager;

  private readonly connectionQueueManager: ConnectionQueueManager;

  private readonly checkTelephonyRequester: CheckTelephonyRequester;

  private readonly pingServerRequester: PingServerRequester;

  private readonly registrationFailedOutOfCallSubscriber: RegistrationFailedOutOfCallSubscriber;

  private readonly attemptsState: AttemptsState;

  private readonly delayBetweenAttempts: DelayRequester;

  private connectorSubscriber?: ISubscriber;

  public constructor({
    connectionQueueManager,
    connectionManager,
    callManager,
    options,
  }: {
    connectionQueueManager: ConnectionQueueManager;
    connectionManager: ConnectionManager;
    callManager: CallManager;
    options?: IAutoConnectorOptions;
  }) {
    this.events = new TypedEvents<TEventMap>(EVENT_NAMES);
    this.connectionManager = connectionManager;
    this.connectionQueueManager = connectionQueueManager;

    this.checkTelephonyRequester = new CheckTelephonyRequester({
      connectionManager,
      interval: options?.checkTelephonyRequestInterval ?? DEFAULT_CHECK_TELEPHONY_REQUEST_INTERVAL,
    });
    this.pingServerRequester = new PingServerRequester({ connectionManager, callManager });
    this.registrationFailedOutOfCallSubscriber = new RegistrationFailedOutOfCallSubscriber({
      connectionManager,
      callManager,
    });
    this.attemptsState = new AttemptsState();
    this.delayBetweenAttempts = new DelayRequester(
      options?.timeoutBetweenAttempts ?? DEFAULT_TIMEOUT_BETWEEN_ATTEMPTS,
    );
  }

  public get isAttemptInProgress(): boolean {
    return this.attemptsState.isAttemptInProgress;
  }

  public start(parameters: TParametersAutoConnect) {
    logger('auto connector start');

    this.connectorSubscriber = parameters.connectorSubscriber;

    this.cancel();
    this.connect(parameters).catch((error: unknown) => {
      logger('auto connector failed to connect:', error);
    });
  }

  public cancel() {
    logger('auto connector cancel');

    if (this.isAttemptInProgress) {
      this.connectionQueueManager.stop();
    }

    this.delayBetweenAttempts.cancelRequest();
    this.attemptsState.reset();
    this.stopConnectTriggers();

    this.disconnectIfConfigured().catch((error: unknown) => {
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

  private runCheckTelephony(parameters: TParametersAutoConnect) {
    logger('runCheckTelephony');

    this.checkTelephonyRequester.start({
      getParameters: parameters.getCheckTelephonyParameters,
      clearCache: parameters.clearCache,
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
      const connectParameters = await parameters.getConnectParameters();

      if (!connectParameters) {
        return;
      }

      await this.connectWithDisconnect(connectParameters, parameters.hasReadyForConnection);

      logger('processConnect success');

      this.subscribeToConnectTriggers(parameters);

      this.events.trigger(EEvent.CONNECTED, {});
    } catch (error) {
      if (hasPromiseIsNotActualError(error as TErrorSipConnector)) {
        logger('processConnect: not actual error', error);

        this.events.trigger(EEvent.CANCELLED, {});

        return;
      }

      logger('processConnect: error', error);

      this.reconnect(parameters);
    }
  }

  private handleLimitReached(parameters: TParametersAutoConnect) {
    this.attemptsState.finishAttempt();

    this.events.trigger(EEvent.FAILED, { isRequestTimeoutError: false });

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

    this.connectorSubscriber?.subscribe(() => {
      logger('connectorSubscriber callback');

      this.start(parameters);
    });
  }

  private stopConnectTriggers() {
    logger('stopConnectTriggers');

    this.pingServerRequester.stop();
    this.checkTelephonyRequester.stop();
    this.registrationFailedOutOfCallSubscriber.unsubscribe();
    this.connectorSubscriber?.unsubscribe();
  }

  private connectIfDisconnected(parameters: TParametersAutoConnect) {
    const isFailedOrDisconnected =
      this.connectionManager.isFailed || this.connectionManager.isDisconnected;

    logger('connectIfDisconnected: isFailedOrDisconnected', isFailedOrDisconnected);

    if (isFailedOrDisconnected) {
      this.start(parameters);
    } else {
      this.stopConnectTriggers();
      this.events.trigger(EEvent.CONNECTED, {});
    }
  }

  private reconnect(parameters: TParametersAutoConnect) {
    logger('reconnect');

    this.delayBetweenAttempts
      .request()
      .then(async () => {
        logger('reconnect: delayBetweenAttempts success');

        return parameters.clearCache?.();
      })
      .then(async () => {
        logger('reconnect: clearCache success');

        return this.connect(parameters);
      })
      .catch((error: unknown) => {
        if (isCanceledError(error) || hasCanceledError(error as Error)) {
          this.events.trigger(EEvent.CANCELLED, {});
        } else {
          this.events.trigger(EEvent.FAILED, { isRequestTimeoutError: false });
        }

        logger('reconnect: error', error);
      });
  }

  private async connectWithDisconnect(
    parameters: TParametersConnect,
    hasReadyForConnection?: () => boolean,
  ) {
    return this.connectionQueueManager
      .disconnect()
      .catch((error: unknown) => {
        logger('connectWithDisconnect: disconnect error', error);
      })
      .then(async () => {
        logger('connectWithDisconnect: disconnect success');

        return this.connectWithProcessError(parameters, hasReadyForConnection);
      });
  }

  private async connectWithProcessError(
    parameters: TParametersConnect,
    hasReadyForConnection?: () => boolean,
  ) {
    const isReadyForConnection = hasReadyForConnection?.() ?? true;

    logger('connectWithProcessError: isReadyForConnection, ', isReadyForConnection);

    if (!isReadyForConnection) {
      return;
    }

    await this.connectionQueueManager
      .connect(parameters)
      .then((isConnected) => {
        logger('connect, isConnected', isConnected);
      })
      .catch(async (error: unknown) => {
        const isErrorNullOrUndefined = error === null || error === undefined;

        if (!isErrorNullOrUndefined && hasPromiseIsNotActualError(error as TErrorSipConnector)) {
          throw error;
        }

        const connectToServerError =
          error instanceof Error ? error : new Error('Failed to connect to server');

        logger('connectWithProcessError, error:', error);

        return this.disconnectIfConfigured()
          .then(() => {
            throw connectToServerError;
          })
          .catch(() => {
            throw connectToServerError;
          });
      });
  }

  private async disconnectIfConfigured() {
    const isConfigured = this.connectionManager.isConfigured();

    logger('disconnect: isConfigured, ', isConfigured);

    if (isConfigured) {
      return this.connectionQueueManager.disconnect();
    }

    return undefined;
  }
}

export default AutoConnectorManager;
