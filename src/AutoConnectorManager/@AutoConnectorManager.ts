import { isCanceledError } from '@krivega/cancelable-promise';
import { DelayRequester, hasCanceledError } from '@krivega/timeout-requester';
import { TypedEvents } from 'events-constructor';

import { hasPromiseIsNotActualError, type ConnectionQueueManager } from '@/ConnectionQueueManager';
import log from '@/logger';
import AttemptsConnector from './AttemptsConnector';
import CheckTelephonyRequester from './CheckTelephonyRequester';
import { EEvent, EVENT_NAMES } from './eventNames';
import PingServerRequester from './PingServerRequester';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { TParametersCheckTelephony } from './CheckTelephonyRequester';
import type { TEventMap, TEvents } from './eventNames';
import type { IAutoConnectorOptions } from './types';

type TParametersConnect = Parameters<ConnectionQueueManager['connect']>[0];

type TParametersAutoConnect = {
  getConnectParameters: () => TParametersConnect;
  getCheckTelephonyParameters: () => TParametersCheckTelephony;
  clearCache?: () => Promise<void>;
};

type TErrorSipConnector = Error & { cause: string };

const hasFailAuthError = (error: unknown) => {
  return error instanceof Error && error.message.includes('failAuth');
};

const REQUEST_TIMEOUT_CAUSE = 'Request Timeout' as const;

const hasRequestTimeoutError = ({ cause }: TErrorSipConnector): boolean => {
  return cause === REQUEST_TIMEOUT_CAUSE;
};

const DEFAULT_TIMEOUT_BETWEEN_ATTEMPTS = 3000;

class AutoConnectorManager {
  public readonly events: TEvents;

  private readonly connectionQueueManager: ConnectionQueueManager;

  private readonly checkTelephonyRequester: CheckTelephonyRequester;

  private readonly pingServerRequester: PingServerRequester;

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
    this.connectionQueueManager = connectionQueueManager;

    this.checkTelephonyRequester = new CheckTelephonyRequester({
      connectionManager,
      interval: checkTelephonyRequestInterval,
    });
    this.pingServerRequester = new PingServerRequester({ connectionManager, callManager });
    this.attemptsConnector = new AttemptsConnector();
    this.delayBetweenAttempts = new DelayRequester(timeoutBetweenAttempts);
  }

  public processConnectWithResetAttempts(parameters: TParametersAutoConnect) {
    log('processConnectWithResetAttempts');

    this.cancel();
    this.processConnect(parameters).catch((error: unknown) => {
      log('failed to process connect:', error);
    });
  }

  public cancel() {
    log('cancel');

    this.delayBetweenAttempts.cancelRequest();
    this.pingServerRequester.stop();
    this.attemptsConnector.reset();

    this.disconnectInner().catch((error: unknown) => {
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

  private readonly runCheckTelephony = (parameters: TParametersAutoConnect) => {
    log('runCheckTelephony');

    this.checkTelephonyRequester.start({
      getParameters: parameters.getCheckTelephonyParameters,
      clearCache: parameters.clearCache,
      onSuccessRequest: () => {
        log('runCheckTelephony: onSuccessRequest');

        this.processConnectIfDisconnected(parameters);
      },
      onFailRequest: () => {
        log('runCheckTelephony: onFailRequest');
      },
    });
  };

  private readonly processConnect = async (parameters: TParametersAutoConnect) => {
    log('processConnect: attempts.count', this.attemptsConnector.count);

    // onBeforeAttemptConnect
    this.events.trigger(EEvent.BEFORE_ATTEMPT, {});
    this.stopPing();

    const isLimitReached = this.attemptsConnector.hasLimitReached();

    if (isLimitReached) {
      log('processConnect: isLimitReached!');

      this.attemptsConnector.startCheckTelephony();

      this.events.trigger(EEvent.FAILED, { isRequestTimeoutError: false });

      this.runCheckTelephony(parameters);

      return;
    }

    this.attemptsConnector.startConnect();
    this.attemptsConnector.increment();

    const connectParameters = parameters.getConnectParameters();

    await this.connectInner(connectParameters)
      .then(() => {
        log('processConnect success');

        this.pingServerRequester.start({
          onFailRequest: () => {
            log('pingServer onFailRequest');

            this.processConnectWithResetAttempts(parameters);
          },
        });

        this.events.trigger(EEvent.CONNECTED, {});
      })
      .catch((error: unknown) => {
        const isPromiseIsNotActualError = hasPromiseIsNotActualError(error as TErrorSipConnector);

        if (isPromiseIsNotActualError) {
          log('processConnect: not actual error', error);

          this.events.trigger(EEvent.CANCELLED, {});

          return;
        }

        const isFailAuthError = hasFailAuthError(error as TErrorSipConnector);

        if (isFailAuthError) {
          log('processConnect: FailAuthError', error);

          this.cancel();

          this.events.trigger(EEvent.FAILED, {
            isRequestTimeoutError: hasRequestTimeoutError(error as TErrorSipConnector),
          });

          return;
        }

        log('processConnect: error', error);

        this.processReconnect(parameters);
      });
  };

  private readonly stopPing = () => {
    log('stopPing');

    this.pingServerRequester.stop();
    this.checkTelephonyRequester.stop();
  };

  private readonly processConnectIfDisconnected = (parameters: TParametersAutoConnect) => {
    const hasFailedOrDisconnected = (): boolean => {
      return false;
    };

    log('processConnectIfDisconnected: hasFailedOrDisconnected', hasFailedOrDisconnected());

    if (hasFailedOrDisconnected()) {
      this.processConnectWithResetAttempts(parameters);
    } else {
      this.stopPing();
      this.events.trigger(EEvent.CONNECTED, {});
    }
  };

  private readonly processReconnect = (parameters: TParametersAutoConnect) => {
    log('processReconnect');

    this.delayBetweenAttempts
      .request()
      .then(async () => {
        log('processReconnect: delayBetweenAttempts success');

        return parameters.clearCache?.();
      })
      .then(async () => {
        log('processReconnect: clearCache success');

        return this.processConnect(parameters);
      })
      .catch((error: unknown) => {
        if (isCanceledError(error) || hasCanceledError(error as Error)) {
          this.events.trigger(EEvent.CANCELLED, {});
        } else {
          this.events.trigger(EEvent.FAILED, { isRequestTimeoutError: false });
        }

        log('processReconnect: error', error);
      });
  };

  private async connectInner(params: TParametersConnect) {
    return this.connectionQueueManager
      .disconnect()
      .catch(() => {})
      .then(async () => {
        return this.connectionQueueManager.connect(params);
      });
  }

  private async disconnectInner() {
    return this.connectionQueueManager.disconnect().catch(() => {});
  }
}

export default AutoConnectorManager;
