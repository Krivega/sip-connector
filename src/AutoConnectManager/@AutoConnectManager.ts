import { isCanceledError } from '@krivega/cancelable-promise';
import { DelayRequester, hasCanceledError } from '@krivega/timeout-requester';

import { hasPromiseIsNotActualError, type ConnectionQueueManager } from '@/ConnectionQueueManager';
import log from '@/logger';
import AttemptsConnector from './AttemptsConnector';
import CheckTelephonyRequester from './CheckTelephonyRequester';
import PingServerRequester from './PingServerRequester';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { TOptionsCheckTelephony, TParametersCheckTelephony } from './CheckTelephonyRequester';

type TParametersConnect = Parameters<ConnectionQueueManager['connect']>[0];

type TCheckTelephony = {
  getParameters: () => TParametersCheckTelephony;
  options: TOptionsCheckTelephony;
};

type TCallbacks = {
  onSuccess: () => void;
  onBeforeAttemptConnect: () => void;
  onFail: (parameters: { isRequestTimeoutError: boolean }) => void;
  onCancel?: () => void;
};

type TErrorSipConnector = Error & { cause: string };

const hasFailAuthError = (error: unknown) => {
  return error instanceof Error && error.message.includes('failAuth');
};

const REQUEST_TIMEOUT_CAUSE = 'Request Timeout' as const;

const hasRequestTimeoutError = ({ cause }: TErrorSipConnector): boolean => {
  return cause === REQUEST_TIMEOUT_CAUSE;
};

class AutoConnectManager {
  private readonly connectionQueueManager: ConnectionQueueManager;

  private readonly checkTelephonyRequester: CheckTelephonyRequester;

  private readonly pingServerRequester: PingServerRequester;

  private readonly attemptsConnector: AttemptsConnector;

  private readonly delayBetweenAttempts: DelayRequester;

  public constructor({
    connectionQueueManager,
    connectionManager,
    callManager,
  }: {
    connectionQueueManager: ConnectionQueueManager;
    connectionManager: ConnectionManager;
    callManager: CallManager;
  }) {
    this.connectionQueueManager = connectionQueueManager;
    this.checkTelephonyRequester = new CheckTelephonyRequester({ connectionManager });
    this.pingServerRequester = new PingServerRequester({ connectionManager, callManager });
    this.attemptsConnector = new AttemptsConnector();
    this.delayBetweenAttempts = new DelayRequester(3000);
  }

  public processConnectWithResetAttempts(parameters: {
    connectParameters: TParametersConnect;
    checkTelephony: TCheckTelephony;
    callbacks?: TCallbacks;
  }) {
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

  private readonly runCheckTelephony = (parameters: {
    connectParameters: TParametersConnect;
    checkTelephony: TCheckTelephony;
    callbacks?: TCallbacks;
  }) => {
    log('runCheckTelephony');

    // clearDNSCache на уровне электрона
    // + requestServerIp -> {sipServerIp, remoteAddress, isUnifiedSdpSemantic} (проверка на 200 и использование sipServerIp)
    // + sipConnectorFacade.checkTelephony по  по полученным {sipServerIp, remoteAddress, isUnifiedSdpSemantic}
    this.checkTelephonyRequester.start(parameters.checkTelephony);

    // успех
    (() => {
      log('runCheckTelephony: onSuccessRequest');

      this.processConnectIfDisconnected(parameters);
    })();

    // ошибка
    (() => {
      log('runCheckTelephony: onFailRequest');
    })();
  };

  private readonly processConnect = async (parameters: {
    connectParameters: TParametersConnect;
    checkTelephony: TCheckTelephony;
    callbacks?: TCallbacks;
  }) => {
    log('processConnect: attempts.count', this.attemptsConnector.count);

    parameters.callbacks?.onBeforeAttemptConnect();
    this.stopPing();

    const isLimitReached = this.attemptsConnector.hasLimitReached();

    if (isLimitReached) {
      log('processConnect: isLimitReached!');

      this.attemptsConnector.startCheckTelephony();

      parameters.callbacks?.onFail({
        isRequestTimeoutError: false,
      });

      this.runCheckTelephony(parameters);

      return;
    }

    this.attemptsConnector.startConnect();
    this.attemptsConnector.increment();

    // requestServerIp -> {sipServerIp, remoteAddress, isUnifiedSdpSemantic}
    // + checkAuth {name, password}
    // + sipConnectorFacade.connect по полученным {sipServerIp, remoteAddress, isUnifiedSdpSemantic}
    // sipServerUrl: sipServerIp,
    // sipWebSocketServerURL: `wss://${sipServerUrl}/webrtc/wss/`,

    await this.connectInner(parameters.connectParameters)
      .then(() => {
        log('processConnect success');

        this.pingServerRequester.start();

        // after ping start
        log('pingServer onFailRequest');

        this.processConnectWithResetAttempts(parameters);

        parameters.callbacks?.onSuccess();
      })
      .catch((error: unknown) => {
        const isPromiseIsNotActualError = hasPromiseIsNotActualError(error as TErrorSipConnector);

        if (isPromiseIsNotActualError) {
          log('processConnect: not actual error', error);

          parameters.callbacks?.onCancel?.();

          return;
        }

        const isFailAuthError = hasFailAuthError(error as TErrorSipConnector);

        if (isFailAuthError) {
          log('processConnect: FailAuthError', error);

          this.cancel();

          parameters.callbacks?.onFail({
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

  private readonly processConnectIfDisconnected = (parameters: {
    connectParameters: TParametersConnect;
    checkTelephony: TCheckTelephony;
    callbacks?: TCallbacks;
  }) => {
    const hasFailedOrDisconnected = (): boolean => {
      return false;
    };

    log('processConnectIfDisconnected: hasFailedOrDisconnected', hasFailedOrDisconnected());

    if (hasFailedOrDisconnected()) {
      this.processConnectWithResetAttempts(parameters);
    } else {
      this.stopPing();
      parameters.callbacks?.onSuccess();
    }
  };

  private readonly processReconnect = (parameters: {
    connectParameters: TParametersConnect;
    checkTelephony: TCheckTelephony;
    callbacks?: TCallbacks;
  }) => {
    log('processReconnect');

    this.delayBetweenAttempts
      .request()
      .then(async () => {
        log('processReconnect: delayBetweenAttempts success');

        // return this.cancelableRequestClearDNSCache.request();
      })
      .then(async () => {
        log('processReconnect: clearDNSCache success');

        return this.processConnect(parameters);
      })
      .catch((error: unknown) => {
        if (isCanceledError(error) || hasCanceledError(error as Error)) {
          parameters.callbacks?.onCancel?.();
        } else {
          parameters.callbacks?.onFail({
            isRequestTimeoutError: false,
          });
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

export default AutoConnectManager;
