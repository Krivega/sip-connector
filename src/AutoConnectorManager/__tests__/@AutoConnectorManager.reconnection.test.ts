import { DelayRequester } from '@krivega/timeout-requester';

import delayPromise from '@/__fixtures__/delayPromise';
import flushPromises from '@/__fixtures__/flushPromises';
import { doMockSipConnector } from '@/doMock';
import AutoConnectorManager from '../@AutoConnectorManager';

import type { SipConnector } from '@/SipConnector';
import type {
  IAutoConnectorOptions,
  TNetworkInterfacesSubscriber,
  TParametersAutoConnect,
  TResumeFromSleepModeSubscriber,
} from '../types';

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

  let emitChangeNetworkInterfaces: (() => void) | undefined;

  const networkInterfacesSubscriberMock: TNetworkInterfacesSubscriber = {
    subscribe: jest.fn(({ onChange }: { onChange: () => void; onUnavailable: () => void }) => {
      emitChangeNetworkInterfaces = onChange;
    }),
    unsubscribe: jest.fn(() => {
      emitChangeNetworkInterfaces = undefined;
    }),
  };

  let emitResumeFromSleepMode: (() => void) | undefined;

  const resumeFromSleepModeSubscriberMock: TResumeFromSleepModeSubscriber = {
    subscribe: jest.fn(({ onResume }: { onResume: () => void }) => {
      emitResumeFromSleepMode = onResume;
    }),
    unsubscribe: jest.fn(() => {
      emitResumeFromSleepMode = undefined;
    }),
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
      networkInterfacesSubscriber: networkInterfacesSubscriberMock,
      resumeFromSleepModeSubscriber: resumeFromSleepModeSubscriberMock,
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

      expect(onBeforeRetryMock).toHaveBeenCalled();
      expect(connectSpy).toHaveBeenCalledTimes(2);
    });

    it('должен дождаться сброса машины состояний перед запуском повторного подключения при выходе из спящего режима', async () => {
      manager.start(baseParameters);

      await manager.wait('success');

      // мокаем метод оставновки ua
      const { ua } = sipConnector.connectionManager;

      if (ua === undefined) {
        throw new Error('ua is not defined');
      }

      ua.stop = jest.fn();

      emitResumeFromSleepMode?.();

      // Ждем произвольное время, чтобы убедиться, что подключение не завершено
      await delayPromise(DELAY);

      // После resume вызывается disconnect(): состояние либо ещё established, либо уже disconnecting
      const state = sipConnector.connectionManager.connectionState;

      expect(['connection:established', 'connection:disconnecting']).toContain(state);

      // триггерим событие отключения от ua
      // @ts-ignore приватное свойство
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      ua.events.trigger('disconnected');

      expect(sipConnector.connectionManager.connectionState).toBe('connection:disconnected');

      await manager.wait('before-attempt');

      // проверка сброса состояния после успешного дисконнекта
      expect(sipConnector.connectionManager.connectionState).toBe('connection:idle');

      // ждем успешного повторного подключения
      await manager.wait('success');

      expect(sipConnector.connectionManager.connectionState).toBe('connection:established');
    });
  });

  describe('переподключение при активном звонке', () => {
    it('не должен делать рестарт при событии resumeFromSleepModeSubscriber onResume если активен звонок', async () => {
      const restartSpy = jest.spyOn(manager.stateMachine, 'toRestart');

      manager.start(baseParameters);

      await manager.wait('success');

      expect(restartSpy).toHaveBeenCalledTimes(1);

      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(true);
      sipConnector.callManager.events.trigger('call-status-changed', { isCallActive: true });

      await flushPromises();

      emitResumeFromSleepMode?.();

      await flushPromises();

      expect(restartSpy).toHaveBeenCalledTimes(1);
    });

    it('не должен делать рестарт при событии networkInterfacesSubscriber onChange если активен звонок', async () => {
      const restartSpy = jest.spyOn(manager.stateMachine, 'toRestart');

      manager.start(baseParameters);

      await manager.wait('success');

      expect(restartSpy).toHaveBeenCalledTimes(1);

      jest.spyOn(sipConnector.callManager, 'isCallActive', 'get').mockReturnValue(true);
      sipConnector.callManager.events.trigger('call-status-changed', { isCallActive: true });

      emitChangeNetworkInterfaces?.();

      await flushPromises();

      expect(restartSpy).toHaveBeenCalledTimes(1);
    });
  });
});
