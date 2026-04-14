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
import PingServerIfNotActiveCallRequester from '../PingServerIfNotActiveCallRequester';
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

  describe('start и stop', () => {
    it('start: запускает процесс подключения', async () => {
      expect(sipConnector.isConfigured()).toBe(false);

      manager.start(baseParameters);

      await delayPromise(10);

      expect(sipConnector.isConfigured()).toBe(true);
    });

    it('start: на холодном старте не делает лишний disconnect', () => {
      const disconnectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'disconnect');

      manager.start(baseParameters);

      expect(disconnectSpy).not.toHaveBeenCalled();
    });

    it('start: делает disconnect, если есть активный connect request', async () => {
      const disconnectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'disconnect');

      jest.spyOn(sipConnector.connectionManager, 'requested', 'get').mockReturnValue(true);

      manager.start(baseParameters);
      await flushPromises();

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('start: делает disconnect, если connection manager уже в disconnecting', async () => {
      const disconnectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'disconnect');

      jest.spyOn(sipConnector.connectionManager, 'isDisconnecting', 'get').mockReturnValue(true);
      jest.spyOn(sipConnector.connectionManager, 'isDisconnected', 'get').mockReturnValue(false);

      manager.start(baseParameters);
      await flushPromises();

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('start: не должна всплывать ошибка, если connect завершился с ошибкой', async () => {
      const error = new Error('Connect error');

      jest.spyOn(sipConnector.connectionQueueManager, 'disconnect').mockRejectedValue(error);

      manager.start(baseParameters);

      expect(mcuDebugLogger).toHaveBeenCalled();
    });

    it('restart: no-op без предшествующего start (нет parameters в контексте)', async () => {
      expect(sipConnector.isConfigured()).toBe(false);

      manager.restart();

      await delayPromise(10);

      expect(sipConnector.isConfigured()).toBe(false);
    });

    it('restart: запускает процесс подключения из idle, переиспользуя parameters из контекста', async () => {
      manager.start(baseParameters);
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

      manager.start(baseParameters);
      await manager.wait('success');
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

      await flushPromises();

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

      manager.start(baseParameters);
      await flushPromises();

      manager.stop();

      expect(() => {
        manager.restart();
      }).not.toThrow();
    });
  });

  describe('базовые события', () => {
    it('вызывает before-attempt в начале подключения', async () => {
      const handleBeforeAttempt = jest.fn();

      manager.on('before-attempt', handleBeforeAttempt);
      manager.start(baseParameters);

      await flushPromises();

      expect(handleBeforeAttempt).toHaveBeenCalled();
    });

    it('вызывает changed-attempt-status при изменении статуса попытки', async () => {
      const handleAttemptStatusChanged = jest.fn();

      manager.on('changed-attempt-status', handleAttemptStatusChanged);
      manager.start(baseParameters);

      await flushPromises();

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
      manager.start(baseParameters);

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

      manager.start(baseParameters);

      await manager.wait('limit-reached-attempts');

      expect(handleLimitReached).toHaveBeenCalled();
      hasLimitReachedSpy.mockRestore();
    });

    it('вызывает failed-attempt при ошибке реконнекта', async () => {
      const handleFailed = jest.fn();
      const error = new Error('Unknown error');

      jest.spyOn(sipConnector.connectionQueueManager, 'connect').mockRejectedValue(error);
      jest.spyOn(DelayRequester.prototype, 'request').mockRejectedValue(error);

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
      manager.start(baseParameters);

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
