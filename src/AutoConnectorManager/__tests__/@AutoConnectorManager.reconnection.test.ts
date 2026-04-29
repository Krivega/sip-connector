import { DelayRequester } from '@krivega/timeout-requester';

import delayPromise from '@/__fixtures__/delayPromise';
import flushPromises from '@/__fixtures__/flushPromises';
import { doMockSipConnector } from '@/doMock';
import { dataForConnectionWithAuthorizationIncorrectPassword } from '@/tools/__fixtures__/connectToServer';
import AutoConnectorManager from '../@AutoConnectorManager';

import type { SipConnector } from '@/SipConnector';
import type { IAutoConnectorOptions, TParametersAutoConnect } from '../types';

const DELAY = 100;

jest.mock('@/logger');

describe('AutoConnectorManager - Reconnection', () => {
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

      manager.start(parametersWithUndefined).catch(() => {});

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
      manager.start(baseParameters).catch(() => {});

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

      manager.start(baseParameters).catch(() => {});

      await flushPromises();

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalledTimes(2);
    });

    it('при неверном пароле должен останавливать авто-подключение без retry', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');
      const retryDelaySpy = jest.spyOn(DelayRequester.prototype, 'request');

      manager
        .start({
          getParameters: async () => {
            return dataForConnectionWithAuthorizationIncorrectPassword;
          },
        })
        .catch(() => {});

      try {
        await Promise.race([
          manager.wait('stop-attempts-by-error'),
          delayPromise(1500).then(() => {
            throw new Error('stop-attempts-by-error not emitted');
          }),
        ]);
      } finally {
        manager.stop();
      }

      expect(connectSpy).toHaveBeenCalledTimes(1);
      expect(retryDelaySpy).not.toHaveBeenCalled();
    });
  });
});
