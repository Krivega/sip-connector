import { DelayRequester } from '@krivega/timeout-requester';
import * as TimeoutRequester from '@krivega/timeout-requester';
import { createMediaStreamMock } from 'webrtc-mock';

import delayPromise from '@/__fixtures__/delayPromise';
import { doMockSipConnector } from '@/doMock';
import logger from '@/logger';
import AutoConnectorManager from '../@AutoConnectorManager';
import AttemptsState from '../AttemptsState';
import CallStatusSubscriber from '../CallStatusSubscriber';
import CheckTelephonyRequester from '../CheckTelephonyRequester';
import PingServerRequester from '../PingServerRequester';
import RegistrationFailedOutOfCallSubscriber from '../RegistrationFailedOutOfCallSubscriber';

import type { SipConnector } from '@/SipConnector';
import type {
  TParametersAutoConnect,
  TParametersCheckTelephony,
  TParametersConnect,
} from '../types';

const DELAY = 100;

jest.mock('@/ConnectionQueueManager', () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return {
    ...jest.requireActual('@/ConnectionQueueManager'),
    hasPromiseIsNotActualError: jest.fn((error: Error) => {
      return error.message === 'Promise is not actual';
    }),
  };
});

jest.mock('@/logger', () => {
  return jest.fn();
});

describe('AutoConnectorManager', () => {
  let sipConnector: SipConnector;
  let baseParameters: TParametersAutoConnect;

  const clearCacheMock = jest.fn();

  const createManager = (options?: {
    timeoutBetweenAttempts?: number;
    checkTelephonyRequestInterval?: number;
  }) => {
    return new AutoConnectorManager({
      connectionQueueManager: sipConnector.connectionQueueManager,
      connectionManager: sipConnector.connectionManager,
      callManager: sipConnector.callManager,
      options: {
        timeoutBetweenAttempts: options?.timeoutBetweenAttempts ?? 1,
        checkTelephonyRequestInterval: options?.checkTelephonyRequestInterval ?? 1,
        clearCache: clearCacheMock,
      },
    });
  };

  beforeEach(() => {
    sipConnector = doMockSipConnector();

    baseParameters = {
      getConnectParameters: async () => {
        return {
          sipServerUrl: 'sip',
          sipWebSocketServerURL: 'wss',
          register: false,
        } as unknown as TParametersConnect;
      },
      getCheckTelephonyParameters: async () => {
        return {
          sipServerUrl: 'sip',
          sipWebSocketServerURL: 'wss',
          displayName: 'x',
        } as unknown as TParametersCheckTelephony;
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('сброс состояний перед подключением', () => {
    it('происходит сброс подписчиков и отключение пинга и проверки телефонии', () => {
      const stopPingSpy = jest.spyOn(PingServerRequester.prototype, 'stop');
      const stopTelephonySpy = jest.spyOn(CheckTelephonyRequester.prototype, 'stop');
      const unsubscribeRegSpy = jest.spyOn(
        RegistrationFailedOutOfCallSubscriber.prototype,
        'unsubscribe',
      );
      const resetAttemptsSpy = jest.spyOn(AttemptsState.prototype, 'reset');
      const cancelDelaySpy = jest.spyOn(DelayRequester.prototype, 'cancelRequest');
      const connectorSubscriberUnsubscribeMock = jest.fn();

      const manager = createManager();

      manager.start(baseParameters);

      expect(stopPingSpy).toHaveBeenCalled();
      expect(stopTelephonySpy).toHaveBeenCalled();
      expect(unsubscribeRegSpy).toHaveBeenCalled();
      expect(resetAttemptsSpy).toHaveBeenCalled();
      expect(cancelDelaySpy).toHaveBeenCalled();
      expect(connectorSubscriberUnsubscribeMock).toHaveBeenCalled();
    });

    it('должен происходить disconnect, если isConfigured=true', () => {
      jest.spyOn(sipConnector.connectionManager, 'isConfigured').mockReturnValue(true);

      const disconnectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'disconnect');

      const manager = createManager();

      manager.start(baseParameters);

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('не должен происходить disconnect, если isConfigured=false', () => {
      jest.spyOn(sipConnector.connectionManager, 'isConfigured').mockReturnValue(false);

      const disconnectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'disconnect');

      const manager = createManager();

      manager.start(baseParameters);

      expect(disconnectSpy).not.toHaveBeenCalled();
    });
  });

  describe('подключение', () => {
    it('успешно подключается и эмитит before-attempt/connected', async () => {
      const handleBeforeAttempt = jest.fn();
      const handleConnected = jest.fn();

      const manager = createManager();

      manager.on('before-attempt', handleBeforeAttempt);
      manager.on('connected', handleConnected);

      manager.start(baseParameters);

      await manager.wait('connected');

      expect(handleBeforeAttempt).toHaveBeenCalled();
      expect(handleConnected).toHaveBeenCalled();
    });

    it('не продолжает процесс, если getConnectParameters возвращает undefined', async () => {
      const handleConnected = jest.fn();

      const manager = createManager();

      manager.on('connected', handleConnected);
      manager.start({
        ...baseParameters,
        getConnectParameters: async () => {
          return undefined;
        },
      });

      await delayPromise(DELAY);

      expect(handleConnected).not.toHaveBeenCalled();
    });

    it('эмитит cancelled при ошибке not actual', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');
      const handleCancelled = jest.fn();

      connectSpy.mockRejectedValue(new Error('Promise is not actual'));

      const manager = createManager();

      manager.on('cancelled', handleCancelled);
      manager.start(baseParameters);

      await manager.wait('cancelled');

      expect(handleCancelled).toHaveBeenCalled();
    });

    it('эмитит failed и запускает checkTelephony при достижении лимита', async () => {
      const startTelephonySpy = jest.spyOn(CheckTelephonyRequester.prototype, 'start');
      const handleFailed = jest.fn();

      const manager = createManager();

      // @ts-ignore приватное свойство
      manager.attemptsState.hasLimitReached = () => {
        return true;
      };

      manager.on('failed', handleFailed);
      manager.start(baseParameters);

      expect(handleFailed).toHaveBeenCalledWith({ isRequestTimeoutError: false });
      expect(startTelephonySpy).toHaveBeenCalled();
    });

    it('после сетевой ошибки делает реконнект после задержки', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');

      connectSpy.mockRejectedValue(new Error('Network Error'));

      const manager = createManager({ timeoutBetweenAttempts: DELAY });

      manager.start(baseParameters);

      jest.clearAllMocks();

      expect(clearCacheMock).not.toHaveBeenCalled();

      await manager.wait('connected');

      expect(clearCacheMock).toHaveBeenCalled();
      expect(connectSpy).toHaveBeenCalled();
    });

    it('останавливает очередь при cancel, только если попытка активна', async () => {
      const stopQueueSpy = jest.spyOn(sipConnector.connectionQueueManager, 'stop');

      const manager = createManager();

      manager.cancel();

      expect(stopQueueSpy).not.toHaveBeenCalled();

      manager.start(baseParameters);
      manager.cancel();

      expect(stopQueueSpy).toHaveBeenCalled();
    });
  });

  describe('подписчики', () => {
    it('перезапускает попытку при ошибке регистрации вне звонка', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');

      const manager = createManager();

      manager.start(baseParameters);

      await manager.wait('connected');

      expect(connectSpy).toHaveBeenCalledTimes(1);

      await sipConnector.call({
        number: '10000',
        mediaStream: createMediaStreamMock({
          audio: { deviceId: { exact: 'audioDeviceId' } },
          video: { deviceId: { exact: 'videoDeviceId' } },
        }),
      });

      sipConnector.connectionManager.events.trigger(
        'registrationFailed',
        new Error('registration failed'),
      );

      await sipConnector.hangUp();
      await manager.wait('connected');

      expect(connectSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('requesters', () => {
    it('запускает подключение при ошибке пинга', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');
      const startPingSpy = jest.spyOn(PingServerRequester.prototype, 'start');
      const subscribeSpy = jest.spyOn(CallStatusSubscriber.prototype, 'subscribe');

      const manager = createManager();

      manager.start(baseParameters);

      await manager.wait('connected');

      expect(connectSpy).toHaveBeenCalledTimes(1);
      expect(startPingSpy).toHaveBeenCalledTimes(1);
      expect(subscribeSpy).toHaveBeenCalledWith(expect.any(Function), { fireImmediately: true });

      const [{ onFailRequest }] = startPingSpy.mock.calls[0] as [{ onFailRequest: () => void }];

      onFailRequest();

      await manager.wait('connected');

      expect(connectSpy).toHaveBeenCalledTimes(2);
    });

    it('runCheckTelephony: onSuccessRequest вызывает попытку при isFailed/isDisconnected', async () => {
      const startTelephonySpy = jest.spyOn(CheckTelephonyRequester.prototype, 'start');
      const connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');

      const manager = createManager();

      // форсим достижение лимита, чтобы запустился runCheckTelephony
      // @ts-ignore приватное свойство
      manager.attemptsState.hasLimitReached = () => {
        return true;
      };

      manager.start(baseParameters);

      const args = startTelephonySpy.mock.calls[0]?.[0] as
        | { onSuccessRequest: () => void }
        | undefined;

      expect(args).toBeDefined();

      // эмулируем, что соединение не установлено
      jest
        .spyOn(sipConnector.connectionManager, 'isDisconnected', 'get')
        .mockReturnValue(true as unknown as boolean);

      args?.onSuccessRequest();

      expect(connectSpy).toHaveBeenCalled();
    });
  });

  describe('события', () => {
    it('once вызывается один раз при нескольких connected', async () => {
      const handler = jest.fn();

      const connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');
      const subscribeMock = jest.fn();

      let externalTrigger: (() => void) | undefined;

      const manager = createManager();

      subscribeMock.mockImplementation((callback: () => void) => {
        externalTrigger = callback;
      });

      manager.once('connected', handler);

      manager.start(baseParameters);

      await manager.wait('connected');

      expect(handler).toHaveBeenCalledTimes(1);

      externalTrigger?.();

      await manager.wait('connected');

      expect(connectSpy).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('onceRace реагирует на первое событие', async () => {
      const handler = jest.fn();
      const connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');

      connectSpy.mockRejectedValue(new Error('Promise is not actual'));

      const manager = createManager();

      manager.onceRace(['connected', 'cancelled'], handler);

      manager.start(baseParameters);

      await manager.wait('cancelled');

      expect(handler).toHaveBeenCalledWith({}, 'cancelled');
    });

    it('off отписывает обработчик', async () => {
      const handler = jest.fn();

      const manager = createManager();

      manager.on('connected', handler);
      manager.off('connected', handler);

      manager.start(baseParameters);

      await manager.wait('connected');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('connectIfDisconnected (реакция проверки телефонии)', () => {
    it('при isFailed=true запускает повторную попытку', async () => {
      const startTelephonySpy = jest.spyOn(CheckTelephonyRequester.prototype, 'start');
      const connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');

      const manager = createManager();

      // форсим запуск проверки телефонии
      // @ts-ignore приватное свойство
      manager.attemptsState.hasLimitReached = () => {
        return true;
      };

      manager.start(baseParameters);

      // имитируем, что соединение провалено
      jest
        .spyOn(sipConnector.connectionManager, 'isFailed', 'get')
        .mockReturnValue(true as unknown as boolean);

      const args = startTelephonySpy.mock.calls[0]?.[0] as
        | { onSuccessRequest: () => void }
        | undefined;

      expect(args).toBeDefined();

      args?.onSuccessRequest();

      expect(connectSpy).toHaveBeenCalled();
    });

    it('при isFailed=false и isDisconnected=false — останавливает триггеры и эмитит connected', async () => {
      const startTelephonySpy = jest.spyOn(CheckTelephonyRequester.prototype, 'start');
      const stopPingSpy = jest.spyOn(PingServerRequester.prototype, 'stop');
      const stopTelephonySpy = jest.spyOn(CheckTelephonyRequester.prototype, 'stop');
      const unsubscribeRegSpy = jest.spyOn(
        RegistrationFailedOutOfCallSubscriber.prototype,
        'unsubscribe',
      );

      const manager = createManager();

      // форсим запуск проверки телефонии
      // @ts-ignore приватное свойство
      manager.attemptsState.hasLimitReached = () => {
        return true;
      };

      // оба флага — false
      jest
        .spyOn(sipConnector.connectionManager, 'isFailed', 'get')
        .mockReturnValue(false as unknown as boolean);
      jest
        .spyOn(sipConnector.connectionManager, 'isDisconnected', 'get')
        .mockReturnValue(false as unknown as boolean);

      manager.start(baseParameters);

      const args = startTelephonySpy.mock.calls[0]?.[0] as
        | { onSuccessRequest: () => void }
        | undefined;

      expect(args).toBeDefined();

      args?.onSuccessRequest();

      await manager.wait('connected');

      expect(stopPingSpy).toHaveBeenCalled();
      expect(stopTelephonySpy).toHaveBeenCalled();
      expect(unsubscribeRegSpy).toHaveBeenCalled();
    });
  });

  describe('обработка ошибок в start/cancel', () => {
    it('start гасит исключение из connect и логирует', async () => {
      const loggerSpy = logger as unknown as jest.Mock;

      const manager = createManager();

      jest
        .spyOn(
          AutoConnectorManager.prototype as unknown as { connect: () => Promise<void> },
          'connect',
        )
        .mockRejectedValueOnce(new Error('boom'));

      expect(() => {
        manager.start(baseParameters);
      }).not.toThrow();

      await delayPromise(0);

      expect(loggerSpy).toHaveBeenCalled();
    });

    it('cancel гасит ошибку в disconnectIfConfigured и логирует', async () => {
      const loggerSpy = logger as unknown as jest.Mock;

      jest.spyOn(sipConnector.connectionManager, 'isConfigured').mockReturnValue(true);

      const disconnectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'disconnect');

      disconnectSpy.mockRejectedValue(new Error('disconnect error'));

      const manager = createManager();

      expect(() => {
        manager.cancel();
      }).not.toThrow();

      await delayPromise(0);

      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('connectWithProcessError', () => {
    it('не вызывает connect, если isReadyForConnection=false', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');

      const manager = createManager();

      manager.start({
        ...baseParameters,
        hasReadyForConnection: () => {
          return false;
        },
      });

      await manager.wait('connected');

      expect(connectSpy).not.toHaveBeenCalled();
    });

    it('продолжает после ошибки disconnect и всё равно вызывает connect', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');

      const disconnectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'disconnect');

      disconnectSpy.mockRejectedValueOnce(new Error('disconnect error'));

      const manager = createManager();

      manager.start(baseParameters);

      await manager.wait('connected');

      expect(connectSpy).toHaveBeenCalled();
    });
  });

  describe('reconnect', () => {
    it('при ошибке задержки с hasCanceledError=true — эмитит cancelled', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');
      const requestSpy = jest.spyOn(DelayRequester.prototype, 'request');
      const hasCanceledSpy = jest.spyOn(TimeoutRequester, 'hasCanceledError').mockReturnValue(true);

      connectSpy.mockRejectedValue(new Error('Network Error'));
      requestSpy.mockRejectedValue(new Error('cancel delay'));

      const manager = createManager();

      manager.start(baseParameters);

      await manager.wait('cancelled');

      expect(hasCanceledSpy).toHaveBeenCalled();
    });

    it('при ошибке задержки с hasCanceledError=false — эмитит failed', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');
      const requestSpy = jest.spyOn(DelayRequester.prototype, 'request');

      connectSpy.mockRejectedValue(new Error('Network Error'));
      requestSpy.mockRejectedValue(new Error('delay failed'));

      const manager = createManager();

      const handleFailed = jest.fn();

      manager.on('failed', handleFailed);

      manager.start(baseParameters);

      await delayPromise(DELAY);

      expect(handleFailed).toHaveBeenCalledWith({ isRequestTimeoutError: false });
    });
  });
});
