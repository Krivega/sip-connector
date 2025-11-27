import { DelayRequester } from '@krivega/timeout-requester';

import delayPromise from '@/__fixtures__/delayPromise';
import { doMockSipConnector } from '@/doMock';
import AutoConnectorManager from '../@AutoConnectorManager';

import type { SipConnector } from '@/SipConnector';
import type { IAutoConnectorOptions, TParametersAutoConnect } from '../types';

const DELAY = 100;

jest.mock('@/logger', () => {
  return jest.fn();
});

describe('AutoConnectorManager - Reconnection', () => {
  let sipConnector: SipConnector;
  let manager: AutoConnectorManager;
  let onBeforeRetryMock: jest.Mock;

  const parameters = {
    displayName: 'Test User',
    sipServerUrl: 'sip://test.com',
    sipWebSocketServerURL: 'wss://test.com',
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
    onBeforeRetryMock = jest.fn().mockResolvedValue(undefined);

    baseParameters = {
      getParameters: getConnectParametersMock,
    };

    manager = createManager({
      onBeforeRetry: onBeforeRetryMock,
      timeoutBetweenAttempts: 100,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // @ts-ignore приватное свойство
    manager.attemptsState.limitInner = 30;
  });

  describe('переподключение', () => {
    it('не делает переподключение, если отстутствуют параметры', async () => {
      // @ts-expect-error приватное свойство
      const reconnectSpy = jest.spyOn(manager, 'scheduleReconnect');
      // @ts-ignore приватное свойство
      const connectSpy = jest.spyOn(manager.connectionQueueManager, 'connect');
      const errorGetParameters = new Error('getParameters is failed');

      const parametersWithUndefined = {
        ...baseParameters,
        getParameters: async () => {
          throw errorGetParameters;
        },
      };

      // Создаем менеджер с кастомной функцией canRetryOnError
      manager = createManager({
        canRetryOnError: (error: unknown) => {
          // Не повторяем попытки для ошибок получения параметров
          return error !== errorGetParameters;
        },
      });

      manager.start(parametersWithUndefined);

      await delayPromise(DELAY);

      expect(connectSpy).toHaveBeenCalled();
      expect(reconnectSpy).not.toHaveBeenCalled();
    });

    it('не делает переподключение, если промис не актуален', async () => {
      const handleCancelled = jest.fn();

      // @ts-expect-error приватное свойство
      const reconnectSpy = jest.spyOn(manager, 'scheduleReconnect');
      // @ts-ignore приватное свойство
      const connectSpy = jest.spyOn(manager.connectionQueueManager, 'connect');

      // Симулируем долгое подключение
      jest.spyOn(sipConnector.connectionManager, 'connect').mockImplementation(async () => {
        await delayPromise(DELAY * 10);

        return {} as unknown as ReturnType<typeof sipConnector.connectionManager.connect>;
      });

      manager.on('cancelled-attempts', handleCancelled);
      manager.start(baseParameters);

      await delayPromise(DELAY);

      // Останавливаем подключение, чтобы сделать промис неактуальным
      // @ts-expect-error приватное свойство
      manager.connectionQueueManager.stop();

      await manager.wait('cancelled-attempts');

      expect(handleCancelled).toHaveBeenCalled();
      expect(connectSpy).toHaveBeenCalled();
      expect(reconnectSpy).not.toHaveBeenCalled();
    });

    it('делает переподключение после сетевой ошибки с задержкой', async () => {
      // @ts-ignore приватное свойство
      const connectSpy = jest.spyOn(manager.connectionQueueManager, 'connect');
      const delayRequestSpy = jest.spyOn(DelayRequester.prototype, 'request').mockResolvedValue();
      const newError = new Error('Network Error');

      connectSpy.mockRejectedValueOnce(newError);

      // @ts-ignore приватное свойство
      expect(manager.attemptsState.count).toBe(0);

      manager.start(baseParameters);

      // @ts-ignore приватное свойство
      expect(manager.attemptsState.count).toBe(1);

      await manager.wait('success');

      // @ts-ignore приватное свойство
      expect(manager.attemptsState.count).toBe(2);
      expect(delayRequestSpy).toHaveBeenCalled();
      expect(onBeforeRetryMock).toHaveBeenCalled();
      expect(connectSpy).toHaveBeenCalledTimes(2);
    });
  });
});
