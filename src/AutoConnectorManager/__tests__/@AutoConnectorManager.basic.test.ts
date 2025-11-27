import { CancelableRequest } from '@krivega/cancelable-promise';
import { DelayRequester } from '@krivega/timeout-requester';

import delayPromise from '@/__fixtures__/delayPromise';
import { ConnectionQueueManager } from '@/ConnectionQueueManager';
import { doMockSipConnector } from '@/doMock';
import logger from '@/logger';
import AutoConnectorManager from '../@AutoConnectorManager';
import CheckTelephonyRequester from '../CheckTelephonyRequester';
import PingServerIfNotActiveCallRequester from '../PingServerIfNotActiveCallRequester';
import RegistrationFailedOutOfCallSubscriber from '../RegistrationFailedOutOfCallSubscriber';

import type { SipConnector } from '@/SipConnector';
import type { IAutoConnectorOptions, TParametersAutoConnect } from '../types';

const DELAY = 100;

const loggerMock = logger as jest.MockedFunction<typeof logger>;

jest.mock('@/logger', () => {
  return jest.fn();
});

describe('AutoConnectorManager - Basic', () => {
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

  describe('инициализация', () => {
    it('использует asyncNoop, если onBeforeRetry не передан', async () => {
      manager = createManager();

      // @ts-expect-error приватное свойство
      const onBeforeRetryPromise = manager.cancelableRequestBeforeRetry.request();

      await expect(onBeforeRetryPromise).resolves.toBeUndefined();
    });
  });

  describe('start и stop', () => {
    it('start: запускает процесс подключения', async () => {
      expect(sipConnector.isConfigured()).toBe(false);

      manager.start(baseParameters);

      await delayPromise(10);

      expect(sipConnector.isConfigured()).toBe(true);
    });

    it('start: сбрасывает состояния перед подключением', () => {
      // @ts-expect-error
      const stopConnectionFlowSpy = jest.spyOn(manager, 'stopConnectionFlow');

      manager.start(baseParameters);

      expect(stopConnectionFlowSpy).toHaveBeenCalled();
    });

    it('start: не должна всплывать ошибка, если connect завершился с ошибкой', async () => {
      const error = new Error('Connect error');

      // @ts-ignore приватное свойство
      jest.spyOn(manager, 'attemptConnection').mockRejectedValue(error);

      manager.start(baseParameters);

      expect(loggerMock).toHaveBeenCalled();
    });

    it('stop: останавливает все процессы', () => {
      const connectQueueStopSpy = jest.spyOn(ConnectionQueueManager.prototype, 'stop');
      const delayBetweenAttemptsCancelRequestSpy = jest.spyOn(
        DelayRequester.prototype,
        'cancelRequest',
      );
      const cancelableRequestBeforeRetryCancelRequestSpy = jest.spyOn(
        CancelableRequest.prototype,
        'cancelRequest',
      );
      const pingServerIfNotActiveCallStopSpy = jest.spyOn(
        PingServerIfNotActiveCallRequester.prototype,
        'stop',
      );
      const checkTelephonyStopSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'stop');
      const registrationFailedOutOfCallSubscriberUnsubscribeSpy = jest.spyOn(
        RegistrationFailedOutOfCallSubscriber.prototype,
        'unsubscribe',
      );

      manager.start(baseParameters);

      jest.clearAllMocks();

      manager.stop();

      expect(connectQueueStopSpy).toHaveBeenCalled();
      expect(delayBetweenAttemptsCancelRequestSpy).toHaveBeenCalled();
      expect(cancelableRequestBeforeRetryCancelRequestSpy).toHaveBeenCalled();
      expect(pingServerIfNotActiveCallStopSpy).toHaveBeenCalled();
      expect(checkTelephonyStopSpy).toHaveBeenCalled();
      expect(registrationFailedOutOfCallSubscriberUnsubscribeSpy).toHaveBeenCalled();
    });

    it('stop: не останавливает очередь запросов, если попытка подключения не запущена', () => {
      const connectQueueStopSpy = jest.spyOn(ConnectionQueueManager.prototype, 'stop');

      manager.stop();

      // @ts-ignore приватное свойство
      expect(manager.attemptsState.isAttemptInProgress).toBe(false);
      expect(connectQueueStopSpy).not.toHaveBeenCalled();
    });

    it('stop: не должна всплывать ошибка, если disconnect завершился с ошибкой', async () => {
      const error = new Error('Disconnect error');

      // @ts-ignore приватное свойство
      jest.spyOn(manager.connectionQueueManager, 'disconnect').mockRejectedValue(error);

      manager.stop();

      expect(loggerMock).toHaveBeenCalled();
    });
  });

  describe('базовые события', () => {
    it('вызывает before-attempt в начале подключения', async () => {
      const handleBeforeAttempt = jest.fn();

      manager.on('before-attempt', handleBeforeAttempt);
      manager.start(baseParameters);

      expect(handleBeforeAttempt).toHaveBeenCalled();
    });

    it('вызывает changed-attempt-status при изменении статуса попытки', async () => {
      const handleAttemptStatusChanged = jest.fn();

      manager.on('changed-attempt-status', handleAttemptStatusChanged);
      manager.start(baseParameters);

      expect(handleAttemptStatusChanged).toHaveBeenCalledTimes(1);
      expect(handleAttemptStatusChanged).toHaveBeenCalledWith({ isInProgress: true });

      manager.stop();

      expect(handleAttemptStatusChanged).toHaveBeenCalledWith({ isInProgress: false });

      manager.start(baseParameters);

      expect(handleAttemptStatusChanged).toHaveBeenCalledWith({ isInProgress: true });
    });

    it('вызывает success при успешном подключении', async () => {
      const handleSuccess = jest.fn();

      manager.on('success', handleSuccess);
      manager.start(baseParameters);

      await manager.wait('success');

      expect(handleSuccess).toHaveBeenCalled();
    });

    it('вызывает success при запуске проверки телефонии', async () => {
      const handleSuccess = jest.fn();

      jest.spyOn(sipConnector.connectionManager, 'isFailed', 'get').mockReturnValue(false);
      jest.spyOn(sipConnector.connectionManager, 'isDisconnected', 'get').mockReturnValue(false);
      jest.spyOn(sipConnector.connectionManager, 'isIdle', 'get').mockReturnValue(false);

      const startSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'start').mockImplementation();

      // @ts-ignore приватное свойство
      manager.attemptsState.limitInner = 0;

      manager.on('success', handleSuccess);
      manager.start(baseParameters);

      const { onSuccessRequest } = startSpy.mock.calls[0][0] as {
        onSuccessRequest: () => void;
      };

      // @ts-ignore приватное свойство
      manager.attemptsState.limitInner = 10;

      onSuccessRequest();

      expect(handleSuccess).toHaveBeenCalled();
    });

    it('вызывает limit-reached-attempts при достижении лимита попыток', async () => {
      const handleLimitReached = jest.fn();

      manager.on('limit-reached-attempts', handleLimitReached);

      // Устанавливаем лимит попыток = 0 для немедленного срабатывания
      // @ts-ignore приватное свойство
      manager.attemptsState.limitInner = 0;

      manager.start(baseParameters);

      await manager.wait('limit-reached-attempts');

      expect(handleLimitReached).toHaveBeenCalled();
    });

    it('вызывает failed-attempt при ошибке реконнекта', async () => {
      const handleFailed = jest.fn();
      const error = new Error('Unknown error');

      // @ts-ignore приватное свойство
      jest.spyOn(manager.connectionQueueManager, 'connect').mockRejectedValue(error);
      onBeforeRetryMock.mockRejectedValue(error);

      manager.on('failed-all-attempts', handleFailed);
      manager.start(baseParameters);

      await manager.wait('failed-all-attempts');

      expect(handleFailed).toHaveBeenCalledWith(error);
    });

    it('вызывает cancelled-attempt, если промис подключения не актуален', async () => {
      const handleCancelled = jest.fn();

      jest.spyOn(sipConnector.connectionManager, 'connect').mockImplementation(async () => {
        await delayPromise(DELAY * 10);

        return {} as unknown as ReturnType<typeof sipConnector.connectionManager.connect>;
      });

      manager.on('cancelled-attempts', handleCancelled);
      manager.start(baseParameters);

      await delayPromise(DELAY);

      // @ts-expect-error
      manager.connectionQueueManager.stop();

      await manager.wait('cancelled-attempts');

      expect(handleCancelled).toHaveBeenCalled();
    });

    it('вызывает cancelled-attempt при отмене onBeforeRetry', async () => {
      const handleCancelled = jest.fn();

      // @ts-ignore приватное свойство
      jest.spyOn(manager.connectionQueueManager, 'connect').mockRejectedValue(undefined);

      manager = createManager({
        onBeforeRetry: async () => {
          await delayPromise(DELAY * 10);
        },
        timeoutBetweenAttempts: 1,
      });

      manager.on('cancelled-attempts', handleCancelled);
      manager.start(baseParameters);

      await delayPromise(DELAY);

      // @ts-expect-error имитация отмены запроса
      manager.cancelableRequestBeforeRetry.cancelRequest();

      await manager.wait('cancelled-attempts');

      expect(handleCancelled).toHaveBeenCalled();
    });

    it('вызывает cancelled-attempt при отмене delayBetweenAttempts', async () => {
      const handleCancelled = jest.fn();

      // @ts-ignore приватное свойство
      jest.spyOn(manager.connectionQueueManager, 'connect').mockRejectedValue(undefined);

      manager = createManager({
        timeoutBetweenAttempts: DELAY * 10,
      });

      manager.on('cancelled-attempts', handleCancelled);
      manager.start(baseParameters);

      await delayPromise(DELAY);

      // @ts-expect-error имитация отмены запроса
      manager.delayBetweenAttempts.cancelRequest();

      await manager.wait('cancelled-attempts');

      expect(handleCancelled).toHaveBeenCalled();
    });

    it('on: возвращает функцию отписки', () => {
      const handler = jest.fn();
      const unsubscribe = manager.on('success', handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('once: вызывает обработчик один раз', async () => {
      const handler = jest.fn();

      manager.once('success', handler);
      manager.start(baseParameters);

      await manager.wait('success');

      manager.events.trigger('success');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('off: отписывает обработчик', async () => {
      const handler = jest.fn();

      manager.on('success', handler);
      manager.off('success', handler);
      manager.start(baseParameters);

      await manager.wait('success');

      expect(handler).not.toHaveBeenCalled();
    });

    it('wait: возвращает данные события', async () => {
      manager.start(baseParameters);

      const result = await manager.wait('success');

      expect(result).toEqual(undefined);
    });

    it('onceRace: вызывает обработчик с первым сработавшим событием', async () => {
      const raceHandler = jest.fn();

      manager.onceRace(['changed-attempt-status', 'failed-all-attempts'], raceHandler);
      manager.start(baseParameters);

      await manager.wait('success');

      expect(raceHandler).toHaveBeenCalledWith(
        {
          isInProgress: true,
        },
        'changed-attempt-status',
      );
    });
  });
});
