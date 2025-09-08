import { isCanceledError } from '@krivega/cancelable-promise';
import { DelayRequester, hasCanceledError } from '@krivega/timeout-requester';
import { TypedEvents } from 'events-constructor';

import { hasPromiseIsNotActualError } from '@/ConnectionQueueManager';
import log from '@/logger';
import AttemptsConnector from './AttemptsConnector';
import CheckTelephonyRequester from './CheckTelephonyRequester';
import { EEvent, EVENT_NAMES } from './eventNames';
import PingServerRequester from './PingServerRequester';
import RegistrationFailedOutOfCallListener from './RegistrationFailedOutOfCallListener';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { ConnectionQueueManager } from '@/ConnectionQueueManager';
import type { TEventMap, TEvents } from './eventNames';
import type {
  IAutoConnectorOptions,
  TErrorSipConnector,
  TParametersAutoConnect,
  TParametersConnect,
} from './types';

const DEFAULT_TIMEOUT_BETWEEN_ATTEMPTS = 3000;

class AutoConnectorManager {
  public readonly events: TEvents;

  private readonly connectionManager: ConnectionManager;

  private readonly connectionQueueManager: ConnectionQueueManager;

  private readonly checkTelephonyRequester: CheckTelephonyRequester;

  private readonly pingServerRequester: PingServerRequester;

  private readonly registrationFailedOutOfCallListener: RegistrationFailedOutOfCallListener;

  private readonly attemptsConnector: AttemptsConnector;

  private readonly delayBetweenAttempts: DelayRequester;

  public constructor({
    connectionQueueManager,
    connectionManager,
    callManager,
    options: {
      checkTelephonyRequestInterval,
      timeoutBetweenAttempts = DEFAULT_TIMEOUT_BETWEEN_ATTEMPTS,
    },
  }: {
    connectionQueueManager: ConnectionQueueManager;
    connectionManager: ConnectionManager;
    callManager: CallManager;
    options: IAutoConnectorOptions;
  }) {
    this.events = new TypedEvents<TEventMap>(EVENT_NAMES);
    this.connectionManager = connectionManager;
    this.connectionQueueManager = connectionQueueManager;

    this.checkTelephonyRequester = new CheckTelephonyRequester({
      connectionManager,
      interval: checkTelephonyRequestInterval,
    });
    this.pingServerRequester = new PingServerRequester({ connectionManager, callManager });
    this.registrationFailedOutOfCallListener = new RegistrationFailedOutOfCallListener({
      connectionManager,
      callManager,
    });
    this.attemptsConnector = new AttemptsConnector();
    this.delayBetweenAttempts = new DelayRequester(timeoutBetweenAttempts);
  }

  public start(parameters: TParametersAutoConnect) {
    log('start');

    this.cancel();
    this.connect(parameters).catch((error: unknown) => {
      log('failed to connect:', error);
    });
  }

  public cancel() {
    log('cancel');

    this.delayBetweenAttempts.cancelRequest();
    this.pingServerRequester.stop();
    this.attemptsConnector.reset();

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
    log('connect: attempts.count', this.attemptsConnector.count);

    this.events.trigger(EEvent.BEFORE_ATTEMPT, {});
    this.stopConnectionTriggers();

    const isLimitReached = this.attemptsConnector.hasLimitReached();

    if (isLimitReached) {
      log('connect: isLimitReached!');

      this.attemptsConnector.startCheckTelephony();

      this.events.trigger(EEvent.FAILED, { isRequestTimeoutError: false });

      this.runCheckTelephony(parameters);

      return;
    }

    this.attemptsConnector.startConnect();
    this.attemptsConnector.increment();

    await parameters
      .getConnectParameters()
      .then(async (connectParameters) => {
        return this.connectWithDisconnect(connectParameters, parameters.hasReadyForConnection);
      })
      .then(() => {
        log('connect success');

        this.pingServerRequester.start({
          onFailRequest: () => {
            log('pingServer onFailRequest');

            this.start(parameters);
          },
        });

        this.registrationFailedOutOfCallListener.subscribe({
          onFailed: () => {
            log('registrationFailedOutOfCallListener onFailed');

            this.start(parameters);
          },
        });

        this.events.trigger(EEvent.CONNECTED, {});
      })
      .catch((error: unknown) => {
        const isPromiseIsNotActualError = hasPromiseIsNotActualError(error as TErrorSipConnector);

        if (isPromiseIsNotActualError) {
          log('connect: not actual error', error);

          this.events.trigger(EEvent.CANCELLED, {});

          return;
        }

        log('connect: error', error);

        this.reconnect(parameters);
      });
  }

  private stopConnectionTriggers() {
    log('stopConnectionTriggers');

    this.pingServerRequester.stop();
    this.checkTelephonyRequester.stop();
    this.registrationFailedOutOfCallListener.unsubscribe();
  }

  private connectIfDisconnected(parameters: TParametersAutoConnect) {
    const isFailedOrDisconnected =
      this.connectionManager.isFailed || this.connectionManager.isDisconnected;

    log('connectIfDisconnected: isFailedOrDisconnected', isFailedOrDisconnected);

    if (isFailedOrDisconnected) {
      this.start(parameters);
    } else {
      this.stopConnectionTriggers();
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
