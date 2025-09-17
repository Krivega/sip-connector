import { CancelableRequest } from '@krivega/cancelable-promise';
import { DelayRequester } from '@krivega/timeout-requester';

import delayPromise from '@/__fixtures__/delayPromise';
import { doMockSipConnector } from '@/doMock';
import logger from '@/logger';
import AutoConnectorManager from '../@AutoConnectorManager';
import CheckTelephonyRequester from '../CheckTelephonyRequester';
import ConnectFlow from '../ConnectFlow';
import PingServerRequester from '../PingServerRequester';
import RegistrationFailedOutOfCallSubscriber from '../RegistrationFailedOutOfCallSubscriber';

import type { SipConnector } from '@/SipConnector';
import type {
  IAutoConnectorOptions,
  TParametersAutoConnect,
  TParametersCheckTelephony,
  TParametersConnect,
} from '../types';

const DELAY = 100;

const loggerMock = logger as jest.MockedFunction<typeof logger>;

jest.mock('@/logger', () => {
  return jest.fn();
});

describe('AutoConnectorManager', () => {
  let sipConnector: SipConnector;
  let manager: AutoConnectorManager;
  let clearCacheMock: jest.Mock;

  const getConnectParametersMock = async () => {
    return {
      sipServerUrl: 'sip://test.com',
      sipWebSocketServerURL: 'wss://test.com',
      register: false,
    } as unknown as TParametersConnect;
  };

  const getCheckTelephonyParametersMock = async () => {
    return {
      sipServerUrl: 'sip://test.com',
      sipWebSocketServerURL: 'wss://test.com',
      displayName: 'Test User',
    } as unknown as TParametersCheckTelephony;
  };

  let baseParameters: TParametersAutoConnect;

  const createManager = (options?: IAutoConnectorOptions) => {
    return new AutoConnectorManager({
      options,
      connectionQueueManager: sipConnector.connectionQueueManager,
      connectionManager: sipConnector.connectionManager,
      callManager: sipConnector.callManager,
    });
  };

  beforeEach(() => {
    sipConnector = doMockSipConnector();
    clearCacheMock = jest.fn().mockResolvedValue(undefined);

    baseParameters = {
      getConnectParameters: getConnectParametersMock,
      getCheckTelephonyParameters: getCheckTelephonyParametersMock,
    };

    manager = createManager({
      clearCache: clearCacheMock,
      timeoutBetweenAttempts: 100,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('инициализация', () => {
    it('использует asyncNoop, если clearCache не передан', async () => {
      manager = createManager();

      // @ts-expect-error приватное свойство
      const clearCachePromise = manager.cancelableRequestClearCache.request();

      await expect(clearCachePromise).resolves.toBeUndefined();
    });
  });

  describe('start и cancel', () => {
    it('start: запускает процесс подключения', async () => {
      expect(sipConnector.isConfigured()).toBe(false);

      manager.start(baseParameters);

      await delayPromise(10);

      expect(sipConnector.isConfigured()).toBe(true);
    });

    it('start: сбрасывает состояния перед подключением', () => {
      const cancelSpy = jest.spyOn(manager, 'cancel');

      manager.start(baseParameters);

      expect(cancelSpy).toHaveBeenCalled();
    });

    it('start: не должна всплывать ошибка, если connect завершился с ошибкой', async () => {
      const error = new Error('Connect error');

      // @ts-ignore приватное свойство
      jest.spyOn(manager, 'connect').mockRejectedValue(error);

      manager.start(baseParameters);

      expect(loggerMock).toHaveBeenCalled();
    });

    it('cancel: останавливает все процессы', () => {
      const connectFlowStopSpy = jest.spyOn(ConnectFlow.prototype, 'stop');
      const delayBetweenAttemptsCancelRequestSpy = jest.spyOn(
        DelayRequester.prototype,
        'cancelRequest',
      );
      const cancelableRequestClearCacheCancelRequestSpy = jest.spyOn(
        CancelableRequest.prototype,
        'cancelRequest',
      );
      const pingServerStopSpy = jest.spyOn(PingServerRequester.prototype, 'stop');
      const checkTelephonyStopSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'stop');
      const registrationFailedOutOfCallSubscriberUnsubscribeSpy = jest.spyOn(
        RegistrationFailedOutOfCallSubscriber.prototype,
        'unsubscribe',
      );

      manager.start(baseParameters);

      jest.clearAllMocks();

      manager.cancel();

      expect(connectFlowStopSpy).toHaveBeenCalled();
      expect(delayBetweenAttemptsCancelRequestSpy).toHaveBeenCalled();
      expect(cancelableRequestClearCacheCancelRequestSpy).toHaveBeenCalled();
      expect(pingServerStopSpy).toHaveBeenCalled();
      expect(checkTelephonyStopSpy).toHaveBeenCalled();
      expect(registrationFailedOutOfCallSubscriberUnsubscribeSpy).toHaveBeenCalled();
    });

    it('cancel: не останавливает очередь запросов, если попытка подключения не запущена', () => {
      const connectFlowStopSpy = jest.spyOn(ConnectFlow.prototype, 'stop');

      manager.cancel();

      // @ts-ignore приватное свойство
      expect(manager.attemptsState.isAttemptInProgress).toBe(false);
      expect(connectFlowStopSpy).not.toHaveBeenCalled();
    });

    it('cancel: не должна всплывать ошибка, если runDisconnect завершился с ошибкой', async () => {
      const error = new Error('Disconnect error');

      jest.spyOn(ConnectFlow.prototype, 'runDisconnect').mockRejectedValue(error);

      manager.cancel();

      expect(loggerMock).toHaveBeenCalled();
    });

    it('не продолжает процесс, если getConnectParameters возвращает undefined', async () => {
      const connectFlowRunConnectSpy = jest.spyOn(ConnectFlow.prototype, 'runConnect');

      const parametersWithUndefined = {
        ...baseParameters,
        getConnectParameters: async () => {
          return undefined;
        },
      };

      manager.start(parametersWithUndefined);

      await delayPromise(10);

      // ConnectFlow.runConnect не должен быть вызван
      expect(connectFlowRunConnectSpy).not.toHaveBeenCalled();
    });
  });

  describe('события', () => {
    it('вызывает before-attempt в начале подключения', async () => {
      const handleBeforeAttempt = jest.fn();

      manager.on('before-attempt', handleBeforeAttempt);
      manager.start(baseParameters);

      expect(handleBeforeAttempt).toHaveBeenCalled();
    });

    it('вызывает parameters-failed при ошибке в getConnectParameters', async () => {
      const handleParametersFailed = jest.fn();
      const parametersError = new Error('Parameters failed');

      baseParameters.getConnectParameters = async () => {
        throw parametersError;
      };

      manager.on('parameters-failed', handleParametersFailed);
      manager.start(baseParameters);

      await manager.wait('parameters-failed');

      expect(handleParametersFailed).toHaveBeenCalledWith(parametersError);
    });

    it('вызывает attempt-status-changed при изменении статуса попытки', async () => {
      const handleAttemptStatusChanged = jest.fn();

      manager.on('attempt-status-changed', handleAttemptStatusChanged);
      manager.start(baseParameters);

      expect(handleAttemptStatusChanged).toHaveBeenCalledTimes(1);
      expect(handleAttemptStatusChanged).toHaveBeenCalledWith(true);

      manager.cancel();

      expect(handleAttemptStatusChanged).toHaveBeenCalledWith(false);

      manager.start(baseParameters);

      expect(handleAttemptStatusChanged).toHaveBeenCalledWith(true);
    });

    it('вызывает connected при успешном подключении', async () => {
      const handleConnected = jest.fn();

      manager.on('connected', handleConnected);
      manager.start(baseParameters);

      await manager.wait('connected');

      expect(handleConnected).toHaveBeenCalled();
    });

    it('вызывает connected при запуске проверки телефонии', async () => {
      const handleConnected = jest.fn();

      jest.spyOn(sipConnector.connectionManager, 'isFailed', 'get').mockReturnValue(false);
      jest.spyOn(sipConnector.connectionManager, 'isDisconnected', 'get').mockReturnValue(false);

      const startSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'start').mockImplementation();

      // @ts-ignore приватное свойство
      manager.attemptsState.limitInner = 0;

      manager.on('connected', handleConnected);
      manager.start(baseParameters);

      const { onSuccessRequest } = startSpy.mock.calls[0][0] as {
        onSuccessRequest: () => void;
      };

      // @ts-ignore приватное свойство
      manager.attemptsState.limitInner = 10;

      onSuccessRequest();

      expect(handleConnected).toHaveBeenCalled();
    });

    it('вызывает failed при достижении лимита попыток', async () => {
      const handleFailed = jest.fn();

      manager.on('failed', handleFailed);

      // Устанавливаем лимит попыток = 0 для немедленного срабатывания
      // @ts-ignore приватное свойство
      manager.attemptsState.limitInner = 0;

      manager.start(baseParameters);

      expect(handleFailed).toHaveBeenCalled();
    });

    it('вызывает failed при ошибке реконнекта', async () => {
      const handleFailed = jest.fn();
      const error = new Error('Unknown error');

      jest.spyOn(ConnectFlow.prototype, 'runConnect').mockRejectedValue(error);
      clearCacheMock.mockRejectedValue(error);

      manager.on('failed', handleFailed);
      manager.start(baseParameters);

      await manager.wait('failed');

      expect(handleFailed).toHaveBeenCalledWith(error);
    });

    it('вызывает cancelled, если промис подключения не актуален', async () => {
      const handleCancelled = jest.fn();

      jest.spyOn(sipConnector.connectionManager, 'connect').mockImplementation(async () => {
        await delayPromise(DELAY * 10);

        return {} as unknown as ReturnType<typeof sipConnector.connectionManager.connect>;
      });

      manager.on('cancelled', handleCancelled);
      manager.start(baseParameters);

      await delayPromise(DELAY);

      // @ts-expect-error
      manager.connectFlow.stop();

      await manager.wait('cancelled');

      expect(handleCancelled).toHaveBeenCalled();
    });

    it('вызывает cancelled при отмене clearCache', async () => {
      const handleCancelled = jest.fn();

      jest.spyOn(ConnectFlow.prototype, 'runConnect').mockRejectedValue(undefined);

      manager = createManager({
        clearCache: async () => {
          await delayPromise(DELAY * 10);
        },
        timeoutBetweenAttempts: 1,
      });

      manager.on('cancelled', handleCancelled);
      manager.start(baseParameters);

      await delayPromise(DELAY);

      // @ts-expect-error имитация отмены запроса
      manager.cancelableRequestClearCache.cancelRequest();

      await manager.wait('cancelled');

      expect(handleCancelled).toHaveBeenCalled();
    });

    it('вызывает cancelled при отмене delayBetweenAttempts', async () => {
      const handleCancelled = jest.fn();

      jest.spyOn(ConnectFlow.prototype, 'runConnect').mockRejectedValue(undefined);

      manager = createManager({
        timeoutBetweenAttempts: DELAY * 10,
      });

      manager.on('cancelled', handleCancelled);
      manager.start(baseParameters);

      await delayPromise(DELAY);

      // @ts-expect-error имитация отмены запроса
      manager.delayBetweenAttempts.cancelRequest();

      await manager.wait('cancelled');

      expect(handleCancelled).toHaveBeenCalled();
    });

    it('on: возвращает функцию отписки', () => {
      const handler = jest.fn();
      const unsubscribe = manager.on('connected', handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('once: вызывает обработчик один раз', async () => {
      const handler = jest.fn();

      manager.once('connected', handler);
      manager.start(baseParameters);

      await manager.wait('connected');
      manager.events.trigger('connected', {});

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('off: отписывает обработчик', async () => {
      const handler = jest.fn();

      manager.on('connected', handler);
      manager.off('connected', handler);
      manager.start(baseParameters);

      await manager.wait('connected');

      expect(handler).not.toHaveBeenCalled();
    });

    it('wait: возвращает данные события', async () => {
      manager.start(baseParameters);

      const result = await manager.wait('connected');

      expect(result).toEqual({});
    });

    it('onceRace: вызывает обработчик с первым сработавшим событием', async () => {
      const raceHandler = jest.fn();

      manager.onceRace(['connected', 'failed'], raceHandler);
      manager.start(baseParameters);

      await manager.wait('connected');

      expect(raceHandler).toHaveBeenCalledWith({}, 'connected');
    });

    it('проксирует disconnecting и disconnected события', () => {
      const handleDisconnecting = jest.fn();
      const handleDisconnected = jest.fn();

      manager.on('disconnecting', handleDisconnecting);
      manager.on('disconnected', handleDisconnected);

      sipConnector.connectionManager.events.trigger('disconnecting', undefined);
      sipConnector.connectionManager.events.trigger('disconnected', undefined);

      expect(handleDisconnecting).toHaveBeenCalled();
      expect(handleDisconnected).toHaveBeenCalled();
    });
  });

  describe('подписчики и триггеры', () => {
    it('запускает ping server requester после успешного подключения', async () => {
      const pingServerStartSpy = jest.spyOn(PingServerRequester.prototype, 'start');

      manager.start(baseParameters);

      await manager.wait('connected');

      expect(pingServerStartSpy).toHaveBeenCalledWith({
        onFailRequest: expect.any(Function) as () => void,
      });
    });

    it('подписывается на registration failed out of call после подключения', async () => {
      const registrationFailedSubscriberSpy = jest.spyOn(
        RegistrationFailedOutOfCallSubscriber.prototype,
        'subscribe',
      );

      manager.start(baseParameters);

      await manager.wait('connected');

      expect(registrationFailedSubscriberSpy).toHaveBeenCalledWith(
        expect.any(Function) as () => void,
      );
    });

    it('запускает start при onFailRequest в ping server', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionManager, 'connect');
      const startSpy = jest.spyOn(PingServerRequester.prototype, 'start').mockImplementation();

      manager.start(baseParameters);

      await manager.wait('connected');

      const { onFailRequest } = startSpy.mock.calls[0][0] as {
        onFailRequest: () => void;
      };

      expect(connectSpy).toHaveBeenCalledTimes(1);

      onFailRequest();

      await manager.wait('connected');

      expect(connectSpy).toHaveBeenCalledTimes(2);
    });

    it('запускает start при срабатывании registration failed out of call', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionManager, 'connect');
      const subscribeSpy = jest
        .spyOn(RegistrationFailedOutOfCallSubscriber.prototype, 'subscribe')
        .mockImplementation();

      manager.start(baseParameters);

      await manager.wait('connected');

      const [callback] = subscribeSpy.mock.calls[0] as [() => void];

      expect(connectSpy).toHaveBeenCalledTimes(1);

      callback();

      await manager.wait('connected');

      expect(connectSpy).toHaveBeenCalledTimes(2);
    });

    it('stopConnectTriggers: останавливает все триггеры', () => {
      const pingServerStopSpy = jest.spyOn(PingServerRequester.prototype, 'stop');
      const checkTelephonyStopSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'stop');
      const registrationFailedSubscriberUnsubscribeSpy = jest.spyOn(
        RegistrationFailedOutOfCallSubscriber.prototype,
        'unsubscribe',
      );

      // @ts-expect-error
      manager.stopConnectTriggers();

      expect(pingServerStopSpy).toHaveBeenCalled();
      expect(checkTelephonyStopSpy).toHaveBeenCalled();
      expect(registrationFailedSubscriberUnsubscribeSpy).toHaveBeenCalled();
    });

    it('остановка всех триггеров в начале подключения', () => {
      // @ts-expect-error
      const stopConnectTriggersSpy = jest.spyOn(manager, 'stopConnectTriggers');

      manager.start(baseParameters);

      // 1-й раз останавливаются при вызове cancel в start
      expect(stopConnectTriggersSpy).toHaveBeenCalledTimes(2);
    });

    it('остановка всех триггеров успешной проверки телефонии', () => {
      jest.spyOn(sipConnector.connectionManager, 'isFailed', 'get').mockReturnValue(false);
      jest.spyOn(sipConnector.connectionManager, 'isDisconnected', 'get').mockReturnValue(false);

      // @ts-expect-error
      const stopConnectTriggersSpy = jest.spyOn(manager, 'stopConnectTriggers');
      const startSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'start').mockImplementation();

      // @ts-ignore приватное свойство
      manager.attemptsState.limitInner = 0;

      manager.start(baseParameters);

      const { onSuccessRequest } = startSpy.mock.calls[0][0] as {
        onSuccessRequest: () => void;
      };

      jest.clearAllMocks();

      onSuccessRequest();

      expect(stopConnectTriggersSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('проверка телефонии', () => {
    it('запускает check telephony requester при достижении лимита попыток', () => {
      const checkTelephonyStartSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'start');

      // @ts-ignore приватное свойство
      manager.attemptsState.limitInner = 0;

      manager.start(baseParameters);

      expect(checkTelephonyStartSpy).toHaveBeenCalledWith({
        getParameters: baseParameters.getCheckTelephonyParameters,
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

    it('при успешном проверке запускает start в случае, если соединение isDisconnected', async () => {
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

      await manager.wait('connected');

      expect(connectSpy).toHaveBeenCalled();
    });

    it('при успешном проверке запускает start в случае, если соединение isFailed', async () => {
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

      await manager.wait('connected');

      expect(connectSpy).toHaveBeenCalled();
    });
  });

  describe('переподключение', () => {
    it('делает переподключение после сетевой ошибки с задержкой', async () => {
      const connectFlowRunConnectSpy = jest.spyOn(ConnectFlow.prototype, 'runConnect');
      const delayRequestSpy = jest.spyOn(DelayRequester.prototype, 'request').mockResolvedValue();

      connectFlowRunConnectSpy.mockRejectedValueOnce(new Error('Network Error'));
      connectFlowRunConnectSpy.mockResolvedValueOnce(undefined);

      // @ts-ignore приватное свойство
      expect(manager.attemptsState.count).toBe(0);

      manager.start(baseParameters);

      // @ts-ignore приватное свойство
      expect(manager.attemptsState.count).toBe(1);

      await manager.wait('connected');

      // @ts-ignore приватное свойство
      expect(manager.attemptsState.count).toBe(2);
      expect(delayRequestSpy).toHaveBeenCalled();
      expect(clearCacheMock).toHaveBeenCalled();
      expect(connectFlowRunConnectSpy).toHaveBeenCalledTimes(2);
    });
  });
});
