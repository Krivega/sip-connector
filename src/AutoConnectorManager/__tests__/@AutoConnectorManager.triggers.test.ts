import { C as JsSIP_C } from '@krivega/jssip';

import flushPromises from '@/__fixtures__/flushPromises';
import { EConnectionStatus } from '@/ConnectionManager';
import { doMockSipConnector } from '@/doMock';
import AutoConnectorManager from '../@AutoConnectorManager';
import AttemptsState from '../AttemptsState';
import CallSignalingRecovery from '../CallSignalingRecovery';
import CheckTelephonyRequester from '../CheckTelephonyRequester';
import PingServerRequester from '../PingServerRequester';
import RegistrationFailedOutOfCallSubscriber from '../RegistrationFailedOutOfCallSubscriber';

import type UAMock from '@/__fixtures__/UA.mock';
import type { SipConnector } from '@/SipConnector';
import type { IAutoConnectorOptions, TParametersAutoConnect } from '../types';

jest.mock('@/logger');

describe('AutoConnectorManager - Triggers', () => {
  let sipConnector: SipConnector;
  let manager: AutoConnectorManager;

  const parameters = {
    displayName: 'Test User',
    sipServerIp: 'sip://test.com',
    sipServerUrl: 'wss://test.com',
    remoteAddress: '10.10.10.10',
    iceServers: [],
    register: false,
  };

  const getConnectParametersMock = async () => {
    return parameters;
  };

  let baseParameters: TParametersAutoConnect;

  const createManager = (options?: IAutoConnectorOptions) => {
    return new AutoConnectorManager(
      {
        connectionQueueManager: sipConnector.connectionQueueManager,
        connectionManager: sipConnector.connectionManager,
        callManager: sipConnector.callManager,
      },
      options,
    );
  };

  beforeEach(() => {
    sipConnector = doMockSipConnector();

    baseParameters = {
      getParameters: getConnectParametersMock,
    };

    manager = createManager({
      timeoutBetweenAttempts: 100,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('подписчики и триггеры', () => {
    it('запускает ping server requester после успешного подключения', async () => {
      const pingServerStartSpy = jest.spyOn(PingServerRequester.prototype, 'start');

      manager.start(baseParameters).catch(() => {});

      await manager.wait('success');

      expect(pingServerStartSpy).toHaveBeenCalledWith({
        onFailRequest: expect.any(Function) as () => void,
        onPingSucceeded: expect.any(Function) as () => void,
        onPingFailedInCall: expect.any(Function) as () => void,
      });
    });

    it('подписывается на registration failed out of call после подключения', async () => {
      const registrationFailedSubscriberSpy = jest.spyOn(
        RegistrationFailedOutOfCallSubscriber.prototype,
        'subscribe',
      );

      manager.start(baseParameters).catch(() => {});

      await manager.wait('success');

      expect(registrationFailedSubscriberSpy).toHaveBeenCalledWith(
        expect.any(Function) as () => void,
      );
    });

    it('при onFailRequest периодического ping запускает reconnect (второй connect)', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');
      const startSpy = jest.spyOn(PingServerRequester.prototype, 'start').mockImplementation();

      manager.start(baseParameters).catch(() => {});

      await manager.wait('success');

      const { onFailRequest } = startSpy.mock.calls[0][0] as {
        onFailRequest: () => void;
      };

      expect(connectSpy).toHaveBeenCalledTimes(1);

      onFailRequest();

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalledTimes(2);
    });

    it('запускает start при срабатывании registration failed out of call', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionManager, 'connect');
      const subscribeSpy = jest
        .spyOn(RegistrationFailedOutOfCallSubscriber.prototype, 'subscribe')
        .mockImplementation();

      manager.start(baseParameters).catch(() => {});

      await manager.wait('success');

      const [callback] = subscribeSpy.mock.calls[0] as [() => void];

      expect(connectSpy).toHaveBeenCalledTimes(1);

      callback();

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalledTimes(2);
    });

    it('stop: останавливает все connect triggers', async () => {
      const callSignalingRecoveryStopSpy = jest.spyOn(CallSignalingRecovery.prototype, 'stop');
      const pingServerStopSpy = jest.spyOn(PingServerRequester.prototype, 'stop');
      const checkTelephonyStopSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'stop');
      const registrationFailedSubscriberUnsubscribeSpy = jest.spyOn(
        RegistrationFailedOutOfCallSubscriber.prototype,
        'unsubscribe',
      );

      manager.start(baseParameters).catch(() => {});
      await manager.wait('success');

      jest.clearAllMocks();
      await manager.stop();

      expect(pingServerStopSpy).toHaveBeenCalled();
      // Ping останавливается раньше: `waitForSignaling()` из обработчика `signaling-restored` не отправит ping
      expect(pingServerStopSpy.mock.invocationCallOrder[0]).toBeLessThan(
        callSignalingRecoveryStopSpy.mock.invocationCallOrder[0],
      );
      expect(callSignalingRecoveryStopSpy).toHaveBeenCalled();
      expect(checkTelephonyStopSpy).toHaveBeenCalled();
      expect(registrationFailedSubscriberUnsubscribeSpy).toHaveBeenCalled();
    });

    it('в начале подключения сбрасывает connect triggers через инфраструктуру', async () => {
      const pingServerStopSpy = jest.spyOn(PingServerRequester.prototype, 'stop');
      const checkTelephonyStopSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'stop');
      const registrationFailedSubscriberUnsubscribeSpy = jest.spyOn(
        RegistrationFailedOutOfCallSubscriber.prototype,
        'unsubscribe',
      );

      manager.start(baseParameters).catch(() => {});

      await flushPromises();

      expect(pingServerStopSpy).toHaveBeenCalled();
      expect(checkTelephonyStopSpy).toHaveBeenCalled();
      expect(registrationFailedSubscriberUnsubscribeSpy).toHaveBeenCalled();
    });

    it('остановка всех триггеров успешной проверки телефонии', async () => {
      jest.spyOn(sipConnector.connectionManager, 'isDisconnected', 'get').mockReturnValue(false);
      jest.spyOn(sipConnector.connectionManager, 'isIdle', 'get').mockReturnValue(false);

      const startSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'start').mockImplementation();
      const pingServerStopSpy = jest.spyOn(PingServerRequester.prototype, 'stop');
      const checkTelephonyStopSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'stop');
      const registrationFailedSubscriberUnsubscribeSpy = jest.spyOn(
        RegistrationFailedOutOfCallSubscriber.prototype,
        'unsubscribe',
      );
      const hasLimitReachedSpy = jest
        .spyOn(AttemptsState.prototype, 'hasLimitReached')
        .mockImplementation(() => {
          return true;
        });

      manager.start(baseParameters).catch(() => {});

      await flushPromises();

      const { onSuccessRequest } = startSpy.mock.calls[0][1] as {
        onSuccessRequest: () => void;
      };

      jest.clearAllMocks();

      onSuccessRequest();

      expect(pingServerStopSpy).toHaveBeenCalled();
      expect(checkTelephonyStopSpy).toHaveBeenCalled();
      expect(registrationFailedSubscriberUnsubscribeSpy).toHaveBeenCalled();

      hasLimitReachedSpy.mockRestore();
    });
  });

  describe('периодический ping и активный звонок', () => {
    const PING_INTERVAL_MS = 15_000;
    const PING_TIMEOUT_MS = 10_000;

    // Как OPTIONS без ответа в JsSIP: иначе мгновенный отказ по новому транспорту снова переоткроет его
    const rejectByPingTimeout = async () => {
      return new Promise<void>((_resolve, reject) => {
        setTimeout(() => {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          reject({ originator: 'system', cause: JsSIP_C.causes.REQUEST_TIMEOUT });
        }, PING_TIMEOUT_MS);
      });
    };

    let pingSpy: jest.SpyInstance;
    let disconnectSpy: jest.SpyInstance;
    let connectSpy: jest.SpyInstance;
    let failFirstPing: () => void;
    let signalingUnstableHandler: jest.Mock;
    let signalingRestoredHandler: jest.Mock;

    const startCall = () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(true);
    };

    const endCall = () => {
      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(false);
    };

    const failNextPing = async () => {
      await jest.advanceTimersByTimeAsync(PING_INTERVAL_MS);
    };

    beforeEach(async () => {
      pingSpy = jest
        .spyOn(sipConnector.connectionManager, 'ping')
        .mockImplementationOnce(async () => {
          return new Promise<void>((_resolve, reject) => {
            failFirstPing = () => {
              reject(new Error('ping timeout'));
            };
          });
        })
        .mockImplementation(rejectByPingTimeout);

      manager.start(baseParameters).catch(() => {});

      await manager.wait('success');

      jest.useFakeTimers({ doNotFake: ['setImmediate', 'queueMicrotask'] });

      disconnectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'disconnect');
      connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');

      signalingUnstableHandler = jest.fn();
      signalingRestoredHandler = jest.fn();
      manager.on('signaling-unstable', signalingUnstableHandler);
      manager.on('signaling-restored', signalingRestoredHandler);
    });

    it('не разрывает соединение, когда ping не отвечает во время активного звонка', async () => {
      const ua = sipConnector.connectionManager.getUaProtected() as unknown as UAMock;

      startCall();

      failFirstPing();
      await failNextPing();
      await failNextPing();
      await failNextPing();

      expect(disconnectSpy).not.toHaveBeenCalled();
      expect(connectSpy).not.toHaveBeenCalled();
      // Каждый ping без ответа переоткрывает транспорт, ping по новому транспорту уходит сразу
      expect(ua.transport.disconnect).toHaveBeenCalledTimes(5);
      expect(ua.transport.connect).toHaveBeenCalledTimes(5);
      expect(ua.stop).not.toHaveBeenCalled();
      expect(sipConnector.connectionManager.connectionState).toBe(EConnectionStatus.ESTABLISHED);
      expect(pingSpy).toHaveBeenCalledTimes(6);
      expect(signalingUnstableHandler).toHaveBeenCalledTimes(1);
      expect(signalingUnstableHandler).toHaveBeenCalledWith({ failCount: 1 });
      expect(signalingRestoredHandler).not.toHaveBeenCalled();
    });

    it('сообщает signaling-restored по ping, отправленному сразу после переоткрытия транспорта', async () => {
      startCall();
      pingSpy.mockResolvedValueOnce(undefined);

      failFirstPing();
      await jest.advanceTimersByTimeAsync(0);

      expect(signalingUnstableHandler).toHaveBeenCalledTimes(1);
      expect(signalingRestoredHandler).toHaveBeenCalledTimes(1);
      expect(pingSpy).toHaveBeenCalledTimes(2);
    });

    it('по неуспешному ping перед re-INVITE сообщает signaling-unstable, переоткрывает транспорт и подтверждает сигнализацию', async () => {
      const ua = sipConnector.connectionManager.getUaProtected() as unknown as UAMock;

      startCall();
      pingSpy.mockRejectedValueOnce(new Error('ping timeout')).mockResolvedValueOnce(undefined);

      await expect(manager.waitForSignaling()).resolves.toBe(true);

      expect(signalingUnstableHandler).toHaveBeenCalledTimes(1);
      expect(signalingUnstableHandler).toHaveBeenCalledWith({ failCount: 1 });
      expect(signalingRestoredHandler).toHaveBeenCalledTimes(1);
      expect(ua.transport.disconnect).toHaveBeenCalledTimes(1);
      expect(ua.transport.connect).toHaveBeenCalledTimes(1);
      expect(pingSpy).toHaveBeenCalledTimes(3);
      expect(disconnectSpy).not.toHaveBeenCalled();
      expect(sipConnector.connectionManager.connectionState).toBe(EConnectionStatus.ESTABLISHED);
    });

    it('ping перед re-INVITE отменяет идущий ping цикла, не засчитывая его провалом, и продолжает тот же цикл', async () => {
      startCall();
      pingSpy.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);

      await expect(manager.waitForSignaling()).resolves.toBe(true);

      failFirstPing();
      await jest.advanceTimersByTimeAsync(0);

      expect(signalingUnstableHandler).not.toHaveBeenCalled();
      expect(pingSpy).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(PING_INTERVAL_MS - 1);

      expect(pingSpy).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(1);

      expect(pingSpy).toHaveBeenCalledTimes(3);
    });

    it('сообщает signaling-restored при остановке автоконнектора во время нестабильной сигнализации', async () => {
      startCall();

      failFirstPing();
      await failNextPing();

      expect(signalingUnstableHandler).toHaveBeenCalledTimes(1);

      await manager.stop();

      expect(signalingRestoredHandler).toHaveBeenCalledTimes(1);
      expect(signalingRestoredHandler).toHaveBeenCalledWith({});
    });

    it('запускает reconnect при провале ping после завершения звонка', async () => {
      startCall();

      failFirstPing();
      await failNextPing();

      expect(disconnectSpy).not.toHaveBeenCalled();

      expect(signalingRestoredHandler).not.toHaveBeenCalled();

      endCall();
      await failNextPing();

      expect(disconnectSpy).toHaveBeenCalled();
      expect(connectSpy).toHaveBeenCalled();
      expect(signalingUnstableHandler).toHaveBeenCalledTimes(1);
      expect(signalingRestoredHandler).toHaveBeenCalledTimes(1);
    });

    it('после успешного ping во время звонка запускает reconnect только после нового лимита ошибок', async () => {
      startCall();

      failFirstPing();
      await failNextPing();

      pingSpy.mockResolvedValueOnce(undefined);
      await failNextPing();

      expect(signalingRestoredHandler).toHaveBeenCalledTimes(1);

      endCall();
      await failNextPing();

      expect(disconnectSpy).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(PING_INTERVAL_MS + PING_TIMEOUT_MS);

      expect(disconnectSpy).toHaveBeenCalled();
      expect(connectSpy).toHaveBeenCalled();
    });

    it('запускает reconnect после двух провалов ping вне звонка', async () => {
      failFirstPing();
      await failNextPing();
      await failNextPing();

      expect(disconnectSpy).toHaveBeenCalled();
      expect(connectSpy).toHaveBeenCalled();
      expect(signalingUnstableHandler).not.toHaveBeenCalled();
      expect(signalingRestoredHandler).not.toHaveBeenCalled();
    });
  });
});
