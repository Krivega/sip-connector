import { CancelableRequest } from '@krivega/cancelable-promise';
import { DelayRequester } from '@krivega/timeout-requester';

import delayPromise from '@/__fixtures__/delayPromise';
import { hasNotReadyForConnectionError } from '@/ConnectionManager';
import { ConnectionQueueManager } from '@/ConnectionQueueManager';
import { doMockSipConnector } from '@/doMock';
import logger from '@/logger';
import AutoConnectorManager from '../@AutoConnectorManager';
import CheckTelephonyRequester from '../CheckTelephonyRequester';
import PingServerIfNotActiveCallRequester from '../PingServerIfNotActiveCallRequester';
import RegistrationFailedOutOfCallSubscriber from '../RegistrationFailedOutOfCallSubscriber';

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

describe('AutoConnectorManager', () => {
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
      const stopSpy = jest.spyOn(manager, 'stop');

      manager.start(baseParameters);

      expect(stopSpy).toHaveBeenCalled();
    });

    it('start: не должна всплывать ошибка, если connect завершился с ошибкой', async () => {
      const error = new Error('Connect error');

      // @ts-ignore приватное свойство
      jest.spyOn(manager, 'connect').mockRejectedValue(error);

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

  describe('события', () => {
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

    describe('changed-attempt-status события', () => {
      it('вызывает changed-attempt-status при startAttempt в connect', async () => {
        const handleAttemptStatusChanged = jest.fn();

        manager.on('changed-attempt-status', handleAttemptStatusChanged);
        manager.start(baseParameters);

        expect(handleAttemptStatusChanged).toHaveBeenCalledWith({ isInProgress: true });
      });

      it('вызывает changed-attempt-status при сбросе статуса в stop', async () => {
        const handleAttemptStatusChanged = jest.fn();

        manager.on('changed-attempt-status', handleAttemptStatusChanged);

        // Сначала запускаем попытку, чтобы статус стал true
        manager.start(baseParameters);

        // Очищаем предыдущие вызовы
        handleAttemptStatusChanged.mockClear();

        // Вызываем stop - статус должен сброситься
        manager.stop();

        // При остановке статус должен сброситься
        expect(handleAttemptStatusChanged).toHaveBeenCalledWith({ isInProgress: false });
      });

      it('вызывает changed-attempt-status при reset в stopAttempts', async () => {
        const handleAttemptStatusChanged = jest.fn();

        manager.on('changed-attempt-status', handleAttemptStatusChanged);
        manager.start(baseParameters);

        // Очищаем предыдущие вызовы
        handleAttemptStatusChanged.mockClear();

        manager.stop();

        expect(handleAttemptStatusChanged).toHaveBeenCalledWith({ isInProgress: false });
      });

      it('вызывает changed-attempt-status при finishAttempt в STOP_ATTEMPTS_BY_ERROR', async () => {
        const handleAttemptStatusChanged = jest.fn();
        const error = new Error('Test error');

        manager = createManager({
          canRetryOnError: () => {
            return false; // Не разрешаем повторные попытки
          },
        });

        manager.on('changed-attempt-status', handleAttemptStatusChanged);
        manager.on('stop-attempts-by-error', () => {});

        // @ts-ignore приватное свойство
        jest.spyOn(manager.connectionQueueManager, 'connect').mockRejectedValue(error);

        manager.start(baseParameters);

        await manager.wait('stop-attempts-by-error');

        expect(handleAttemptStatusChanged).toHaveBeenCalledWith({ isInProgress: false });
      });

      it('не вызывает changed-attempt-status повторно, если статус не изменился', async () => {
        const handleAttemptStatusChanged = jest.fn();

        manager.on('changed-attempt-status', handleAttemptStatusChanged);

        // Устанавливаем лимит попыток = 0 для немедленного срабатывания
        // @ts-ignore приватное свойство
        manager.attemptsState.limitInner = 0;

        manager.start(baseParameters);

        // Очищаем предыдущие вызовы
        handleAttemptStatusChanged.mockClear();

        // Вызываем start еще раз - статус уже true, поэтому событие не должно сработать
        manager.start(baseParameters);

        expect(handleAttemptStatusChanged).not.toHaveBeenCalled();
      });

      it('не вызывает changed-attempt-status при успешном подключении (статус остается true)', async () => {
        const handleAttemptStatusChanged = jest.fn();

        manager.on('changed-attempt-status', handleAttemptStatusChanged);
        manager.start(baseParameters);

        // Очищаем вызов startAttempt
        handleAttemptStatusChanged.mockClear();

        await manager.wait('success');

        // При успешном подключении статус остается true, поэтому событие не должно сработать
        expect(handleAttemptStatusChanged).not.toHaveBeenCalled();
      });

      it('вызывает changed-attempt-status при hasNotReadyForConnectionError', async () => {
        const handleAttemptStatusChanged = jest.fn();

        manager.on('changed-attempt-status', handleAttemptStatusChanged);
        manager.on('success', () => {}); // Чтобы не ждать события

        // Используем опцию hasReadyForConnection: false чтобы вызвать hasNotReadyForConnectionError
        manager.start({
          getParameters: baseParameters.getParameters,
          options: {
            hasReadyForConnection: () => {
              return false;
            },
          },
        });

        await manager.wait('success');

        // При ошибке not ready for connection статус должен сброситься
        expect(handleAttemptStatusChanged).toHaveBeenCalledWith({ isInProgress: false });
      });

      it('вызывает changed-attempt-status при hasConnectionPromiseIsNotActualError', async () => {
        const handleAttemptStatusChanged = jest.fn();

        manager.on('changed-attempt-status', handleAttemptStatusChanged);
        manager.on('cancelled-attempts', () => {}); // Чтобы не ждать события

        // Мокаем долгое подключение
        jest.spyOn(sipConnector.connectionManager, 'connect').mockImplementation(async () => {
          await delayPromise(DELAY * 10);

          return {} as unknown as ReturnType<typeof sipConnector.connectionManager.connect>;
        });

        manager.start(baseParameters);

        await delayPromise(DELAY);

        // Останавливаем подключение, чтобы сделать промис неактуальным
        // @ts-expect-error приватное свойство
        manager.connectionQueueManager.stop();

        await manager.wait('cancelled-attempts');

        // При ошибке not actual статус должен сброситься
        expect(handleAttemptStatusChanged).toHaveBeenCalledWith({ isInProgress: false });
      });

      it('вызывает changed-attempt-status при ошибке в reconnect', async () => {
        const handleAttemptStatusChanged = jest.fn();
        const error = new Error('Reconnect error');

        manager.on('changed-attempt-status', handleAttemptStatusChanged);
        manager.on('failed-all-attempts', () => {}); // Чтобы не ждать события

        // Мокаем ошибку подключения
        // @ts-ignore приватное свойство
        jest.spyOn(manager.connectionQueueManager, 'connect').mockRejectedValue(error);
        onBeforeRetryMock.mockRejectedValue(error);

        manager.start(baseParameters);

        await manager.wait('failed-all-attempts');

        // При ошибке в reconnect статус должен сброситься
        expect(handleAttemptStatusChanged).toHaveBeenCalledWith({ isInProgress: false });
      });
    });
  });

  describe('подписчики и триггеры', () => {
    it('запускает ping server requester после успешного подключения', async () => {
      const pingServerIfNotActiveCallStartSpy = jest.spyOn(
        PingServerIfNotActiveCallRequester.prototype,
        'start',
      );

      manager.start(baseParameters);

      await manager.wait('success');

      expect(pingServerIfNotActiveCallStartSpy).toHaveBeenCalledWith({
        onFailRequest: expect.any(Function) as () => void,
      });
    });

    it('подписывается на registration failed out of call после подключения', async () => {
      const registrationFailedSubscriberSpy = jest.spyOn(
        RegistrationFailedOutOfCallSubscriber.prototype,
        'subscribe',
      );

      manager.start(baseParameters);

      await manager.wait('success');

      expect(registrationFailedSubscriberSpy).toHaveBeenCalledWith(
        expect.any(Function) as () => void,
      );
    });

    it('запускает start при onFailRequest в ping server', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionManager, 'connect');
      const startSpy = jest
        .spyOn(PingServerIfNotActiveCallRequester.prototype, 'start')
        .mockImplementation();

      manager.start(baseParameters);

      await manager.wait('success');

      const { onFailRequest } = startSpy.mock.calls[0][0] as {
        onFailRequest: () => void;
      };

      expect(connectSpy).toHaveBeenCalledTimes(1);

      onFailRequest();

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalledTimes(2);
    });

    it('запускает start при срабатывании registration failed out of call', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionManager, 'connect');
      const subscribeSpy = jest
        .spyOn(RegistrationFailedOutOfCallSubscriber.prototype, 'subscribe')
        .mockImplementation();

      manager.start(baseParameters);

      await manager.wait('success');

      const [callback] = subscribeSpy.mock.calls[0] as [() => void];

      expect(connectSpy).toHaveBeenCalledTimes(1);

      callback();

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalledTimes(2);
    });

    it('stopConnectTriggers: останавливает все триггеры', () => {
      const pingServerIfNotActiveCallStopSpy = jest.spyOn(
        PingServerIfNotActiveCallRequester.prototype,
        'stop',
      );
      const checkTelephonyStopSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'stop');
      const registrationFailedSubscriberUnsubscribeSpy = jest.spyOn(
        RegistrationFailedOutOfCallSubscriber.prototype,
        'unsubscribe',
      );

      // @ts-expect-error
      manager.stopConnectTriggers();

      expect(pingServerIfNotActiveCallStopSpy).toHaveBeenCalled();
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
      jest.spyOn(sipConnector.connectionManager, 'isIdle', 'get').mockReturnValue(false);

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

  describe('переподключение', () => {
    it('не делает переподключение, если отстутствуют параметры', async () => {
      // @ts-expect-error приватное свойство
      const reconnectSpy = jest.spyOn(manager, 'reconnect');
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
      const reconnectSpy = jest.spyOn(manager, 'reconnect');
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

  describe('подключение', () => {
    it('вызывает connect с данными из getParameters', async () => {
      // @ts-expect-error приватное свойство
      const connectSpy = jest.spyOn(manager.connectionQueueManager, 'connect');

      manager.start(baseParameters);

      const getParameters = connectSpy.mock.calls[0][0] as TParametersAutoConnect['getParameters'];

      const result = await getParameters();

      expect(result).toEqual(parameters);
    });

    it('должен вызывать событие success-attempt и подписываться на слушателей при ошибке not ready for connection', async () => {
      expect.assertions(3);

      const pingServerIfNotActiveCallStartSpy = jest.spyOn(
        PingServerIfNotActiveCallRequester.prototype,
        'start',
      );
      const registrationFailedSubscriberSpy = jest.spyOn(
        RegistrationFailedOutOfCallSubscriber.prototype,
        'subscribe',
      );
      // @ts-ignore приватное свойство
      const connectSpy = jest.spyOn(manager.connectionQueueManager, 'connect');

      manager.start({
        getParameters: baseParameters.getParameters,
        options: {
          hasReadyForConnection: () => {
            return false;
          },
        },
      });

      await manager.wait('success');

      const connectResult = connectSpy.mock.results[0].value as Promise<Error>;

      expect(pingServerIfNotActiveCallStartSpy).toHaveBeenCalled();
      expect(registrationFailedSubscriberSpy).toHaveBeenCalled();

      await connectResult.catch((error: unknown) => {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(hasNotReadyForConnectionError(error)).toBe(true);
      });
    });
  });
});
