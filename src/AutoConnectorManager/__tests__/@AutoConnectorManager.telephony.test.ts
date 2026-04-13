import flushPromises from '@/__fixtures__/flushPromises';
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
    it('запускает check telephony requester при достижении лимита попыток', async () => {
      const checkTelephonyStartSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'start');

      // @ts-ignore приватное свойство
      manager.attemptsState.limitInner = 0;

      manager.start(baseParameters);

      await new Promise((resolve) => {
        manager.once('limit-reached-attempts', resolve);
      });

      expect(checkTelephonyStartSpy).toHaveBeenCalledWith({
        onBeforeRequest: expect.any(Function) as () => Promise<TParametersCheckTelephony>,
        onSuccessRequest: expect.any(Function) as () => void,
        onFailRequest: expect.any(Function) as (error?: unknown) => void,
      });
    });

    it('логирует ошибку в onFailRequest при проверке телефонии', async () => {
      const startSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'start').mockImplementation();

      // @ts-ignore приватное свойство
      manager.attemptsState.limitInner = 0;

      manager.start(baseParameters);

      await flushPromises();

      const { onFailRequest } = startSpy.mock.calls[0][0] as {
        onFailRequest: (error?: unknown) => void;
      };

      const error = new Error('Check telephony error');

      onFailRequest(error);

      expect(loggerMock).toHaveBeenCalled();
    });

    it('эмитит telephony-check-failure и эскалирует warning/critical', async () => {
      const startSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'start').mockImplementation();
      const failureHandler = jest.fn();
      const escalatedHandler = jest.fn();

      manager = createManager({
        telephonyFailPolicy: {
          baseRetryDelayMs: 0,
          maxRetryDelayMs: 0,
          warningThreshold: 2,
          criticalThreshold: 3,
        },
      });

      const restartSpy = jest.spyOn(manager.stateMachine, 'toRestart');

      manager.on('telephony-check-failure', failureHandler);
      manager.on('telephony-check-escalated', escalatedHandler);

      // @ts-ignore приватное свойство
      manager.attemptsState.limitInner = 0;

      manager.start(baseParameters);

      await flushPromises();

      const { onFailRequest } = startSpy.mock.calls[0][0] as {
        onFailRequest: (error?: unknown) => void;
      };
      const error = new Error('Check telephony error');

      jest.clearAllMocks();

      onFailRequest(error);
      onFailRequest(error);
      onFailRequest(error);

      expect(failureHandler).toHaveBeenCalledTimes(3);
      expect(escalatedHandler).toHaveBeenCalledTimes(2);
      expect(escalatedHandler).toHaveBeenNthCalledWith(1, {
        failCount: 2,
        escalationLevel: 'warning',
        error,
      });
      expect(escalatedHandler).toHaveBeenNthCalledWith(2, {
        failCount: 3,
        escalationLevel: 'critical',
        error,
      });
      expect(restartSpy).toHaveBeenCalledTimes(1);
    });

    it('учитывает backoff и не делает лишний reconnect в окне retry', async () => {
      const startSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'start').mockImplementation();

      manager = createManager({
        telephonyFailPolicy: {
          baseRetryDelayMs: 1000,
          maxRetryDelayMs: 5000,
          warningThreshold: 2,
          criticalThreshold: 3,
        },
      });

      const restartSpy = jest.spyOn(manager.stateMachine, 'toRestart');

      // @ts-ignore приватное свойство
      manager.attemptsState.limitInner = 0;

      manager.start(baseParameters);

      await flushPromises();

      const { onFailRequest } = startSpy.mock.calls[0][0] as {
        onFailRequest: (error?: unknown) => void;
      };

      jest.clearAllMocks();

      jest.spyOn(Date, 'now').mockReturnValue(1000);
      onFailRequest(new Error('First fail'));
      expect(restartSpy).toHaveBeenCalledTimes(1);

      (Date.now as jest.Mock).mockReturnValue(1100);
      onFailRequest(new Error('Second fail'));
      expect(restartSpy).toHaveBeenCalledTimes(1);
    });

    it('при успешной проверке запускает start в случае, если соединение isDisconnected', async () => {
      jest.spyOn(sipConnector.connectionManager, 'isDisconnected', 'get').mockReturnValue(true);

      const connectSpy = jest.spyOn(sipConnector.connectionManager, 'connect');
      const startSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'start').mockImplementation();

      // @ts-ignore приватное свойство
      manager.attemptsState.limitInner = 0;

      manager.start(baseParameters);

      await flushPromises();

      const { onSuccessRequest } = startSpy.mock.calls[0][0] as {
        onSuccessRequest: () => void;
      };

      // @ts-ignore приватное свойство
      // eslint-disable-next-line require-atomic-updates
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

      const restartSpy = jest.spyOn(manager.stateMachine, 'toRestart');

      expect(disconnectSpy).toHaveBeenCalled();
      expect(sipConnector.connectionManager.isDisconnected).toBe(false);
      expect(sipConnector.connectionManager.isIdle).toBe(true);

      await manager.wait('before-attempt');

      expect(restartSpy).toHaveBeenCalledTimes(1);
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

        await flushPromises();

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

        await flushPromises();

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

        await flushPromises();

        const { onBeforeRequest } = startSpy.mock.calls[0][0] as {
          onBeforeRequest: () => Promise<TParametersCheckTelephony>;
        };

        await expect(onBeforeRequest()).rejects.toThrow(error);
        expect(onBeforeRetryMock).toHaveBeenCalledTimes(1);
      });
    });
  });
});
