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

describe('AutoConnectorManager - Events', () => {
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

  describe('changed-attempt-status события', () => {
    it('вызывает changed-attempt-status при startAttempt в connect', async () => {
      const handleAttemptStatusChanged = jest.fn();

      manager.on('changed-attempt-status', handleAttemptStatusChanged);
      manager.start(baseParameters);

      await flushPromises();

      expect(handleAttemptStatusChanged).toHaveBeenCalledWith({ isInProgress: true });
    });

    it('вызывает changed-attempt-status при сбросе статуса в stop', async () => {
      const handleAttemptStatusChanged = jest.fn();

      manager.on('changed-attempt-status', handleAttemptStatusChanged);

      // Сначала запускаем попытку, чтобы статус стал true
      manager.start(baseParameters);

      await flushPromises();

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

      await flushPromises();

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
      manager.once('changed-attempt-status', () => {
        handleAttemptStatusChanged.mockClear();
      });

      await manager.wait('success');

      // При успешном подключении статус остается true, поэтому событие не должно сработать
      expect(handleAttemptStatusChanged).not.toHaveBeenCalled();
    });

    it('вызывает stop-attempts-by-error и changed-attempt-status при hasNotReadyForConnectionError', async () => {
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

      await manager.wait('stop-attempts-by-error');

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
