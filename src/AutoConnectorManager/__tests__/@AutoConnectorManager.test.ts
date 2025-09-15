import { DelayRequester } from '@krivega/timeout-requester';

import delayPromise from '@/__fixtures__/delayPromise';
import { doMockSipConnector } from '@/doMock';
import AutoConnectorManager from '../@AutoConnectorManager';
import AttemptsState from '../AttemptsState';
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
describe('AutoConnectorManager', () => {
  let sipConnector: SipConnector;
  let baseParameters: TParametersAutoConnect;

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
      getCheckTelephonyParameters: () => {
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

      manager.start({
        ...baseParameters,
        connectorSubscriber: {
          subscribe: jest.fn(),
          unsubscribe: connectorSubscriberUnsubscribeMock,
        },
      });

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

    it('переключает счетчик и меняет состояние попытки', () => {
      const manager = createManager();

      // @ts-ignore приватное свойство
      expect(manager.attemptsState.count).toBe(0);
      expect(manager.isAttemptInProgress).toBe(false);

      manager.start(baseParameters);

      // @ts-ignore приватное свойство
      expect(manager.attemptsState.count).toBe(1);
      expect(manager.isAttemptInProgress).toBe(true);
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
      const clearCacheMock = jest.fn();

      connectSpy.mockRejectedValue(new Error('Network Error'));

      const manager = createManager({ timeoutBetweenAttempts: DELAY });

      manager.start({
        ...baseParameters,
        clearCache: clearCacheMock,
      });

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
});
