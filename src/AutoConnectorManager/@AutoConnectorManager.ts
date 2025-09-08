import { isCanceledError } from '@krivega/cancelable-promise';
import { DelayRequester, hasCanceledError } from '@krivega/timeout-requester';
import { TypedEvents } from 'events-constructor';

import { hasPromiseIsNotActualError } from '@/ConnectionQueueManager';
import log from '@/logger';
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
    log('start');

    this.connectorSubscriber = parameters.connectorSubscriber;

    this.cancel();
    this.connect(parameters).catch((error: unknown) => {
      log('failed to connect:', error);
    });
  }

  public cancel() {
    log('cancel');

    this.delayBetweenAttempts.cancelRequest();
    this.attemptsState.reset();
    this.stopConnectTriggers();

    this.disconnectIfConfigured().catch((error: unknown) => {
      log('disconnect: error', error);
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
    log('runCheckTelephony');

    this.checkTelephonyRequester.start({
      getParameters: parameters.getCheckTelephonyParameters,
      clearCache: parameters.clearCache,
      onSuccessRequest: () => {
        log('runCheckTelephony: onSuccessRequest');

        this.connectIfDisconnected(parameters);
      },
      onFailRequest: () => {
        log('runCheckTelephony: onFailRequest');
      },
    });
  }

  private async connect(parameters: TParametersAutoConnect) {
    log('connect: attempts.count', this.attemptsState.count);

    this.events.trigger(EEvent.BEFORE_ATTEMPT, {});
    this.stopConnectTriggers();

    const isLimitReached = this.attemptsState.hasLimitReached();

    if (isLimitReached) {
      log('connect: isLimitReached!');

      this.handleLimitReached(parameters);

      return;
    }

    this.attemptsState.startAttempt();
    this.attemptsState.increment();

    return this.processConnect(parameters);
  }

  private async processConnect(parameters: TParametersAutoConnect) {
    await parameters
      .getConnectParameters()
      .then(async (connectParameters) => {
        return this.connectWithDisconnect(connectParameters, parameters.hasReadyForConnection);
      })
      .then(() => {
        log('processConnect success');

        this.subscribeToConnectTriggers(parameters);

        this.events.trigger(EEvent.CONNECTED, {});
      })
      .catch((error: unknown) => {
        const isPromiseIsNotActualError = hasPromiseIsNotActualError(error as TErrorSipConnector);

        if (isPromiseIsNotActualError) {
          log('processConnect: not actual error', error);

          this.events.trigger(EEvent.CANCELLED, {});

          return;
        }

        log('processConnect: error', error);

        this.reconnect(parameters);
      });
  }

  private handleLimitReached(parameters: TParametersAutoConnect) {
    this.attemptsState.finishAttempt();

    this.events.trigger(EEvent.FAILED, { isRequestTimeoutError: false });

    this.runCheckTelephony(parameters);
  }

  private subscribeToConnectTriggers(parameters: TParametersAutoConnect) {
    this.pingServerRequester.start({
      onFailRequest: () => {
        log('pingServer onFailRequest');

        this.start(parameters);
      },
    });

    this.registrationFailedOutOfCallSubscriber.subscribe(() => {
      log('registrationFailedOutOfCallListener callback');

      this.start(parameters);
    });

    this.connectorSubscriber?.subscribe(() => {
      log('connectorSubscriber callback');

      this.start(parameters);
    });
  }

  private stopConnectTriggers() {
    log('stopConnectTriggers');

    this.pingServerRequester.stop();
    this.checkTelephonyRequester.stop();
    this.registrationFailedOutOfCallSubscriber.unsubscribe();
    this.connectorSubscriber?.unsubscribe();
  }

  private connectIfDisconnected(parameters: TParametersAutoConnect) {
    const isFailedOrDisconnected =
      this.connectionManager.isFailed || this.connectionManager.isDisconnected;

    log('connectIfDisconnected: isFailedOrDisconnected', isFailedOrDisconnected);

    if (isFailedOrDisconnected) {
      this.start(parameters);
    } else {
      this.stopConnectTriggers();
      this.events.trigger(EEvent.CONNECTED, {});
    }
  }

  private reconnect(parameters: TParametersAutoConnect) {
    log('reconnect');

    this.delayBetweenAttempts
      .request()
      .then(async () => {
        log('reconnect: delayBetweenAttempts success');

        return parameters.clearCache?.();
      })
      .then(async () => {
        log('reconnect: clearCache success');

        return this.connect(parameters);
      })
      .catch((error: unknown) => {
        if (isCanceledError(error) || hasCanceledError(error as Error)) {
          this.events.trigger(EEvent.CANCELLED, {});
        } else {
          this.events.trigger(EEvent.FAILED, { isRequestTimeoutError: false });
        }

        log('reconnect: error', error);
      });
  }

  private async connectWithDisconnect(
    parameters: TParametersConnect,
    hasReadyForConnection?: () => boolean,
  ) {
    return this.connectionQueueManager
      .disconnect()
      .catch((error: unknown) => {
        log('connectWithDisconnect: disconnect error', error);
      })
      .then(async () => {
        log('connectWithDisconnect: disconnect success');

        return this.connectWithProcessError(parameters, hasReadyForConnection);
      });
  }

  private async connectWithProcessError(
    parameters: TParametersConnect,
    hasReadyForConnection?: () => boolean,
  ) {
    const isReadyForConnection = hasReadyForConnection?.() ?? true;

    log('connectWithProcessError: hasReadyForConnection, ', isReadyForConnection);

    if (!isReadyForConnection) {
      return;
    }

    await this.connectionQueueManager
      .connect(parameters)
      .then((isConnected) => {
        log('connect, isConnected', isConnected);
      })
      .catch(async (error: unknown) => {
        const isErrorNullOrUndefined = error === null || error === undefined;

        if (isErrorNullOrUndefined || !hasPromiseIsNotActualError(error as TErrorSipConnector)) {
          const connectToServerError =
            error instanceof Error ? error : new Error('Failed to connect to server');

          log('connectWithProcessError, error:', error);

          return this.disconnectIfConfigured()
            .then(() => {
              throw connectToServerError;
            })
            .catch(() => {
              throw connectToServerError;
            });
        }

        return undefined;
      });
  }

  private async disconnectIfConfigured() {
    const isConfigured = this.connectionManager.isConfigured();

    log('disconnect: isConfigured, ', isConfigured);

    if (isConfigured) {
      return this.connectionQueueManager.disconnect();
    }

    return undefined;
  }
}

export default AutoConnectorManager;
