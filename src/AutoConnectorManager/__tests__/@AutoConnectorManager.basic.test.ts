import { CancelableRequest } from '@krivega/cancelable-promise';
import { DelayRequester } from '@krivega/timeout-requester';

import delayPromise from '@/__fixtures__/delayPromise';
import flushPromises from '@/__fixtures__/flushPromises';
import { ConnectionQueueManager } from '@/ConnectionQueueManager';
import { doMockSipConnector } from '@/doMock';
import logger from '@/logger';
import AutoConnectorManager from '../@AutoConnectorManager';
import AttemptsState from '../AttemptsState';
import CheckTelephonyRequester from '../CheckTelephonyRequester';
import PingServerRequester from '../PingServerRequester';
import RegistrationFailedOutOfCallSubscriber from '../RegistrationFailedOutOfCallSubscriber';

import type { SipConnector } from '@/SipConnector';
import type { IAutoConnectorOptions, TParametersAutoConnect } from '../types';

const DELAY = 100;

jest.mock('@/logger');

const { mcuDebugLogger } = logger as jest.Mock & { mcuDebugLogger: jest.Mock };

describe('AutoConnectorManager - Basic', () => {
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

  const startAndWaitFor = async (
    eventName: 'success' | 'limit-reached-attempts' | 'failed-all-attempts',
    parametersForStart: TParametersAutoConnect = baseParameters,
  ) => {
    const startPromise = manager.start(parametersForStart);
    const eventPayload = await manager.wait(eventName);

    await startPromise;

    return eventPayload;
  };

  const startAndIgnoreResult = (parametersForStart: TParametersAutoConnect = baseParameters) => {
    manager.start(parametersForStart).catch(() => {});
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

  describe('start и stop', () => {
    it('start: запускает процесс подключения', async () => {
      expect(sipConnector.isConfigured()).toBe(false);

      await manager.start(baseParameters);

      await delayPromise(10);

      expect(sipConnector.isConfigured()).toBe(true);
    });

    it('start: на холодном старте не делает лишний disconnect', async () => {
      const disconnectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'disconnect');

      await manager.start(baseParameters);

      expect(disconnectSpy).not.toHaveBeenCalled();
    });

    it('start: делает disconnect, если есть активный connect request', async () => {
      const disconnectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'disconnect');

      jest.spyOn(sipConnector.connectionManager, 'requested', 'get').mockReturnValue(true);

      await manager.start(baseParameters);
      await flushPromises();

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('start: делает disconnect, если connection manager уже в disconnecting', async () => {
      const disconnectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'disconnect');

      jest.spyOn(sipConnector.connectionManager, 'isDisconnecting', 'get').mockReturnValue(true);
      jest.spyOn(sipConnector.connectionManager, 'isDisconnected', 'get').mockReturnValue(false);

      await manager.start(baseParameters);
      await flushPromises();

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('start: не должна всплывать ошибка, если connect завершился с ошибкой', async () => {
      const error = new Error('Connect error');

      jest.spyOn(sipConnector.connectionQueueManager, 'disconnect').mockRejectedValue(error);

      await manager.start(baseParameters);

      expect(mcuDebugLogger).toHaveBeenCalled();
    });

    it('restart: no-op без предшествующего start (нет parameters в контексте)', async () => {
      expect(sipConnector.isConfigured()).toBe(false);

      manager.restart();

      await delayPromise(10);

      expect(sipConnector.isConfigured()).toBe(false);
    });

    it('restart: запускает процесс подключения из idle, переиспользуя parameters из контекста', async () => {
      await manager.start(baseParameters);
      await flushPromises();
      manager.stop();
      await flushPromises();

      expect(sipConnector.isConfigured()).toBe(false);

      manager.restart();

      await delayPromise(10);

      expect(sipConnector.isConfigured()).toBe(true);
    });

    it('restart: делает disconnect, если вызван в connectedMonitoring', async () => {
      const disconnectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'disconnect');

      await startAndWaitFor('success');
      jest.clearAllMocks();

      manager.restart();
      await flushPromises();

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('stop: останавливает все процессы', async () => {
      const connectQueueStopSpy = jest.spyOn(ConnectionQueueManager.prototype, 'stop');
      const delayBetweenAttemptsCancelRequestSpy = jest.spyOn(
        DelayRequester.prototype,
        'cancelRequest',
      );
      const cancelableRequestBeforeRetryCancelRequestSpy = jest.spyOn(
        CancelableRequest.prototype,
        'cancelRequest',
      );
      const pingServerStopSpy = jest.spyOn(PingServerRequester.prototype, 'stop');
      const checkTelephonyStopSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'stop');
      const registrationFailedOutOfCallSubscriberUnsubscribeSpy = jest.spyOn(
        RegistrationFailedOutOfCallSubscriber.prototype,
        'unsubscribe',
      );

      await manager.start(baseParameters);

      await flushPromises();

      jest.clearAllMocks();

      manager.stop();

      expect(connectQueueStopSpy).toHaveBeenCalled();
      expect(delayBetweenAttemptsCancelRequestSpy).toHaveBeenCalled();
      expect(cancelableRequestBeforeRetryCancelRequestSpy).toHaveBeenCalled();
      expect(pingServerStopSpy).toHaveBeenCalled();
      expect(checkTelephonyStopSpy).toHaveBeenCalled();
      expect(registrationFailedOutOfCallSubscriberUnsubscribeSpy).toHaveBeenCalled();
    });

    it('stop: не останавливает очередь запросов, если попытка подключения не запущена', () => {
      const connectQueueStopSpy = jest.spyOn(ConnectionQueueManager.prototype, 'stop');

      manager.stop();

      expect(connectQueueStopSpy).not.toHaveBeenCalled();
    });

    it('stop: не должна всплывать ошибка, если disconnect завершился с ошибкой', async () => {
      const error = new Error('Disconnect error');

      jest.spyOn(sipConnector.connectionQueueManager, 'disconnect').mockRejectedValue(error);

      manager.stop();

      expect(mcuDebugLogger).toHaveBeenCalled();
    });

    it('restart: не должен бросать ошибку, если вызван во время остановки', async () => {
      jest.spyOn(sipConnector.connectionQueueManager, 'disconnect').mockImplementation(async () => {
        await delayPromise(DELAY * 2);
      });

      await manager.start(baseParameters);
      await flushPromises();

      manager.stop();

      expect(() => {
        manager.restart();
      }).not.toThrow();
    });

    it('start: возвращает success-результат при успешном подключении', async () => {
      const result = await manager.start(baseParameters);

      expect(result).toEqual({
        isSuccess: true,
        reason: 'started',
      });
    });

    it('start: возвращает coalesced-результат при повторном запуске, если manager уже запущен', async () => {
      const firstStartPromise = manager.start(baseParameters);
      const secondStartResult = await manager.start(baseParameters);

      expect(secondStartResult).toEqual({
        isSuccess: false,
        reason: 'coalesced',
      });
      expect(mcuDebugLogger).toHaveBeenCalledWith(
        'auto connector start skipped: already started. Use restart() for force reconnect or stop() before next start()',
      );

      await firstStartPromise;
    });

    it('start: возвращает coalesced-результат, если requestReconnect вернул false', async () => {
      const requestReconnectSpy = jest
        .spyOn(manager as unknown as { requestReconnect: () => boolean }, 'requestReconnect')
        .mockReturnValue(false);

      const result = await manager.start(baseParameters);

      expect(result).toEqual({
        isSuccess: false,
        reason: 'coalesced',
      });

      requestReconnectSpy.mockRestore();
    });

    it('start: после stop снова запускается успешно', async () => {
      await manager.start(baseParameters);
      manager.stop();
      await flushPromises();

      const resultAfterStop = await manager.start(baseParameters);

      expect(resultAfterStop).toEqual({
        isSuccess: true,
        reason: 'started',
      });
    });

    it('start: возвращает stop-attempts-by-error без reject', async () => {
      const result = await manager.start({
        getParameters: baseParameters.getParameters,
        options: {
          hasReadyForConnection: () => {
            return false;
          },
        },
      });

      expect(result.isSuccess).toBe(false);
      expect(result.reason).toBe('stop-attempts-by-error');
    });

    it('start: возвращает failed-all-attempts без reject', async () => {
      const error = new Error('Unknown error');

      jest.spyOn(sipConnector.connectionQueueManager, 'connect').mockRejectedValue(error);
      jest.spyOn(DelayRequester.prototype, 'request').mockRejectedValue(error);

      const result = await manager.start(baseParameters);

      expect(result).toEqual({
        isSuccess: false,
        reason: 'failed-all-attempts',
        error,
      });
    });

    it('start: возвращает limit-reached-attempts без reject', async () => {
      const hasLimitReachedSpy = jest
        .spyOn(AttemptsState.prototype, 'hasLimitReached')
        .mockReturnValue(true);

      const result = await manager.start(baseParameters);

      expect(result.isSuccess).toBe(false);
      expect(result.reason).toBe('limit-reached-attempts');
      hasLimitReachedSpy.mockRestore();
    });
  });

  describe('базовые события', () => {
    it('вызывает before-attempt в начале подключения', async () => {
      const handleBeforeAttempt = jest.fn();

      manager.on('before-attempt', handleBeforeAttempt);
      await manager.start(baseParameters);

      await flushPromises();

      expect(handleBeforeAttempt).toHaveBeenCalled();
    });

    it('вызывает changed-attempt-status при изменении статуса попытки', async () => {
      const handleAttemptStatusChanged = jest.fn();

      manager.on('changed-attempt-status', handleAttemptStatusChanged);
      await manager.start(baseParameters);

      await flushPromises();

      expect(handleAttemptStatusChanged).toHaveBeenCalledTimes(1);
      expect(handleAttemptStatusChanged).toHaveBeenCalledWith({ isInProgress: true });

      manager.stop();

      expect(handleAttemptStatusChanged).toHaveBeenCalledWith({ isInProgress: false });

      await manager.start(baseParameters);

      expect(handleAttemptStatusChanged).toHaveBeenCalledWith({ isInProgress: true });
    });

    it('вызывает success при успешном подключении', async () => {
      const handleSuccess = jest.fn();

      manager.on('success', handleSuccess);
      await startAndWaitFor('success');

      expect(handleSuccess).toHaveBeenCalled();
    });

    it('вызывает success при запуске проверки телефонии', async () => {
      const handleSuccess = jest.fn();

      jest.spyOn(sipConnector.connectionManager, 'isDisconnected', 'get').mockReturnValue(false);
      jest.spyOn(sipConnector.connectionManager, 'isIdle', 'get').mockReturnValue(false);

      const startSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'start').mockImplementation();
      const originalHasLimitReached = AttemptsState.prototype.hasLimitReached;
      const hasLimitReachedSpy = jest
        .spyOn(AttemptsState.prototype, 'hasLimitReached')
        .mockImplementationOnce(() => {
          return true;
        })
        .mockImplementation(function fallbackHasLimitReached(this: AttemptsState) {
          return originalHasLimitReached.call(this);
        });

      manager.on('success', handleSuccess);
      await manager.start(baseParameters);

      await flushPromises();

      const { onSuccessRequest } = startSpy.mock.calls[0][1] as {
        onSuccessRequest: () => void;
      };

      onSuccessRequest();

      expect(handleSuccess).toHaveBeenCalled();
      hasLimitReachedSpy.mockRestore();
    });

    it('вызывает limit-reached-attempts при достижении лимита попыток', async () => {
      const handleLimitReached = jest.fn();
      const hasLimitReachedSpy = jest
        .spyOn(AttemptsState.prototype, 'hasLimitReached')
        .mockReturnValue(true);

      manager.on('limit-reached-attempts', handleLimitReached);
      await startAndWaitFor('limit-reached-attempts');

      expect(handleLimitReached).toHaveBeenCalled();
      hasLimitReachedSpy.mockRestore();
    });

    it('вызывает failed-attempt при ошибке реконнекта', async () => {
      const handleFailed = jest.fn();
      const error = new Error('Unknown error');

      jest.spyOn(sipConnector.connectionQueueManager, 'connect').mockRejectedValue(error);
      jest.spyOn(DelayRequester.prototype, 'request').mockRejectedValue(error);

      manager.on('failed-all-attempts', handleFailed);
      await startAndWaitFor('failed-all-attempts');

      expect(handleFailed).toHaveBeenCalledWith(error);
    });

    it('вызывает cancelled-attempt, если промис подключения не актуален', async () => {
      const handleCancelled = jest.fn();

      jest.spyOn(sipConnector.connectionManager, 'connect').mockImplementation(async () => {
        await delayPromise(DELAY * 10);

        return {} as unknown as ReturnType<typeof sipConnector.connectionManager.connect>;
      });

      manager.on('cancelled-attempts', handleCancelled);
      startAndIgnoreResult();

      await delayPromise(DELAY);

      sipConnector.connectionQueueManager.stop();

      await manager.wait('cancelled-attempts');

      expect(handleCancelled).toHaveBeenCalled();
    });

    it('вызывает cancelled-attempt при отмене delayBetweenAttempts', async () => {
      const handleCancelled = jest.fn();

      jest.spyOn(sipConnector.connectionQueueManager, 'connect').mockRejectedValue(undefined);

      manager = createManager({
        timeoutBetweenAttempts: DELAY * 10,
      });

      manager.on('cancelled-attempts', handleCancelled);
      startAndIgnoreResult();

      await delayPromise(DELAY);

      manager.cancelPendingRetry();

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
      await startAndWaitFor('success');

      manager.events.trigger('success');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('off: отписывает обработчик', async () => {
      const handler = jest.fn();

      manager.on('success', handler);
      manager.off('success', handler);
      await startAndWaitFor('success');

      expect(handler).not.toHaveBeenCalled();
    });

    it('wait: возвращает данные события', async () => {
      const result = await startAndWaitFor('success');

      expect(result).toEqual(undefined);
    });

    it('onceRace: вызывает обработчик с первым сработавшим событием', async () => {
      const raceHandler = jest.fn();

      manager.onceRace(['changed-attempt-status', 'failed-all-attempts'], raceHandler);
      await startAndWaitFor('success');

      expect(raceHandler).toHaveBeenCalledWith(
        {
          isInProgress: true,
        },
        'changed-attempt-status',
      );
    });
  });
});
