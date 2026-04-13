import { DelayRequester } from '@krivega/timeout-requester';

import delayPromise from '@/__fixtures__/delayPromise';
import flushPromises from '@/__fixtures__/flushPromises';
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

  const parameters = {
    displayName: 'Test User',
    sipServerIp: 'sip://test.com',
    sipServerUrl: 'wss://test.com',
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
  });

  describe('переподключение', () => {
    it('не делает переподключение, если отстутствуют параметры', async () => {
      const reconnectSpy = jest.spyOn(DelayRequester.prototype, 'request');
      const connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');
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

      const reconnectSpy = jest.spyOn(DelayRequester.prototype, 'request');
      const connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');

      // Симулируем долгое подключение
      jest.spyOn(sipConnector.connectionManager, 'connect').mockImplementation(async () => {
        await delayPromise(DELAY * 10);

        return {} as unknown as ReturnType<typeof sipConnector.connectionManager.connect>;
      });

      manager.on('cancelled-attempts', handleCancelled);
      manager.start(baseParameters);

      await delayPromise(DELAY);

      // Останавливаем подключение, чтобы сделать промис неактуальным
      sipConnector.connectionQueueManager.stop();

      await manager.wait('cancelled-attempts');

      expect(handleCancelled).toHaveBeenCalled();
      expect(connectSpy).toHaveBeenCalled();
      expect(reconnectSpy).not.toHaveBeenCalled();
    });

    it('делает переподключение после сетевой ошибки с задержкой', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');
      const newError = new Error('Network Error');

      connectSpy.mockRejectedValueOnce(newError);

      manager.start(baseParameters);

      await flushPromises();

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalledTimes(2);
    });
  });
});
