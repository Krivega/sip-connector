import { doMockSipConnector } from '@/doMock';
import logger from '@/logger';
import AutoConnectorManager from '../@AutoConnectorManager';
import CheckTelephonyRequester from '../CheckTelephonyRequester';
import PingServerIfNotActiveCallRequester from '../PingServerIfNotActiveCallRequester';

import type { SipConnector } from '@/SipConnector';
import type {
  IAutoConnectorOptions,
  TParametersAutoConnect,
  TParametersCheckTelephony,
} from '../types';

const DELAY = 100;

const loggerMock = logger as jest.MockedFunction<typeof logger>;

jest.mock('@/logger', () => {
  return jest.fn();
});

describe('AutoConnectorManager - Telephony', () => {
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

  describe('проверка телефонии', () => {
    it('запускает check telephony requester при достижении лимита попыток', () => {
      const checkTelephonyStartSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'start');

      // @ts-ignore приватное свойство
      manager.attemptsState.limitInner = 0;

      manager.start(baseParameters);

      expect(checkTelephonyStartSpy).toHaveBeenCalledWith({
        onBeforeRequest: expect.any(Function) as () => Promise<TParametersCheckTelephony>,
        onSuccessRequest: expect.any(Function) as () => void,
        onFailRequest: expect.any(Function) as (error?: unknown) => void,
      });
    });

    it('логирует ошибку в onFailRequest при проверке телефонии', () => {
      const startSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'start').mockImplementation();

      // @ts-ignore приватное свойство
      manager.attemptsState.limitInner = 0;

      manager.start(baseParameters);

      const { onFailRequest } = startSpy.mock.calls[0][0] as {
        onFailRequest: (error?: unknown) => void;
      };

      const error = new Error('Check telephony error');

      onFailRequest(error);

      expect(loggerMock).toHaveBeenCalled();
    });

    it('при успешной проверке запускает start в случае, если соединение isDisconnected', async () => {
      jest.spyOn(sipConnector.connectionManager, 'isDisconnected', 'get').mockReturnValue(true);

      const connectSpy = jest.spyOn(sipConnector.connectionManager, 'connect');
      const startSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'start').mockImplementation();

      // @ts-ignore приватное свойство
      manager.attemptsState.limitInner = 0;

      manager.start(baseParameters);

      const { onSuccessRequest } = startSpy.mock.calls[0][0] as {
        onSuccessRequest: () => void;
      };

      // @ts-ignore приватное свойство
      manager.attemptsState.limitInner = 10;

      onSuccessRequest();

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalled();
    });

    it('при успешной проверке запускает start в случае, если соединение isFailed', async () => {
      jest.spyOn(sipConnector.connectionManager, 'isFailed', 'get').mockReturnValue(true);

      const connectSpy = jest.spyOn(sipConnector.connectionManager, 'connect');
      const startSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'start').mockImplementation();

      // @ts-ignore приватное свойство
      manager.attemptsState.limitInner = 0;

      manager.start(baseParameters);

      const { onSuccessRequest } = startSpy.mock.calls[0][0] as {
        onSuccessRequest: () => void;
      };

      // @ts-ignore приватное свойство
      manager.attemptsState.limitInner = 10;

      onSuccessRequest();

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalled();
    });

    it('при успешной проверке запускает start в случае, если соединение было отключено', async () => {
      jest
        .spyOn(PingServerIfNotActiveCallRequester.prototype, 'start')
        .mockImplementation(({ onFailRequest }) => {
          setTimeout(() => {
            onFailRequest();
          }, DELAY);
        });

      manager = createManager({
        checkTelephonyRequestInterval: 10,
        timeoutBetweenAttempts: 10,
      });
      manager.start(baseParameters);

      // @ts-ignore приватное свойство
      manager.attemptsState.limitInner = 5;

      await sipConnector.connectionManager.wait('connect-succeeded');

      expect(sipConnector.connectionManager.isConfigured()).toBe(true);

      jest
        // @ts-expect-error
        .spyOn(sipConnector.connectionManager.connectionFlow, 'connect')
        .mockRejectedValue(new Error('connect is rejected'));

      const disconnectSpy = jest.spyOn(sipConnector.connectionManager, 'disconnect');

      await manager.wait('limit-reached-attempts');

      const startSpy = jest.spyOn(manager, 'start');

      expect(disconnectSpy).toHaveBeenCalled();
      expect(sipConnector.connectionManager.isFailed).toBe(false);
      expect(sipConnector.connectionManager.isDisconnected).toBe(false);
      expect(sipConnector.connectionManager.isIdle).toBe(true);

      await manager.wait('before-attempt');

      expect(startSpy).toHaveBeenCalledTimes(1);
    });

    describe('onBeforeRequest', () => {
      it('вызывает onBeforeRetry перед getParameters', async () => {
        const startSpy = jest
          .spyOn(CheckTelephonyRequester.prototype, 'start')
          .mockImplementation();

        // @ts-ignore приватное свойство
        manager.attemptsState.limitInner = 0;

        manager.start({
          getParameters: baseParameters.getParameters,
        });

        const { onBeforeRequest } = startSpy.mock.calls[0][0] as {
          onBeforeRequest: () => Promise<TParametersCheckTelephony>;
        };

        await onBeforeRequest();

        expect(onBeforeRetryMock).toHaveBeenCalledTimes(1);
      });

      it('возвращает данные при успешном getParameters', async () => {
        const startSpy = jest
          .spyOn(CheckTelephonyRequester.prototype, 'start')
          .mockImplementation();

        // @ts-ignore приватное свойство
        manager.attemptsState.limitInner = 0;

        manager.start({
          getParameters: baseParameters.getParameters,
        });

        const { onBeforeRequest } = startSpy.mock.calls[0][0] as {
          onBeforeRequest: () => Promise<TParametersCheckTelephony>;
        };

        const result = await onBeforeRequest();

        expect(result).toEqual(parameters);
      });

      it('выбрасывает ошибку, если параметры отсутствуют', async () => {
        const startSpy = jest
          .spyOn(CheckTelephonyRequester.prototype, 'start')
          .mockImplementation();

        // @ts-ignore приватное свойство
        manager.attemptsState.limitInner = 0;

        const error = new Error('Parameters are missing');

        manager.start({
          getParameters: async () => {
            throw error;
          },
        });

        const { onBeforeRequest } = startSpy.mock.calls[0][0] as {
          onBeforeRequest: () => Promise<TParametersCheckTelephony>;
        };

        await expect(onBeforeRequest()).rejects.toThrow(error);
        expect(onBeforeRetryMock).toHaveBeenCalledTimes(1);
      });
    });
  });
});
