import delayPromise from '@/__fixtures__/delayPromise';
import { hasPromiseIsNotActualError } from '@/ConnectionQueueManager';
import { doMockSipConnector } from '@/doMock';
import ConnectFlow from '../ConnectFlow';

const CONNECTION_DELAY = 100;

describe('ConnectFlow', () => {
  const hasReadyForConnectionMock = jest.fn();

  let sipConnector: ReturnType<typeof doMockSipConnector>;
  let connectFlow: ConnectFlow;

  let hasConfigured: () => boolean;
  let disconnectSpy: jest.SpyInstance;
  let connectSpy: jest.SpyInstance;

  const connectParameters = {
    sipServerUrl: 'test.com',
    sipWebSocketServerURL: 'wss://test.com',
    displayName: 'Test User',
  };

  beforeEach(() => {
    sipConnector = doMockSipConnector();

    hasConfigured = () => {
      return sipConnector.isConfigured();
    };

    connectFlow = new ConnectFlow({
      connectionQueueManager: sipConnector.connectionQueueManager,
      hasConfigured,
    });

    hasReadyForConnectionMock.mockReturnValue(true);
    disconnectSpy = jest.spyOn(sipConnector.connectionManager, 'disconnect');
    connectSpy = jest.spyOn(sipConnector.connectionManager, 'connect');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('должен успешно подключиться', async () => {
    expect.assertions(1);

    await connectFlow.runConnect(connectParameters);

    expect(sipConnector.isConfigured()).toBe(true);
  });

  it('должен успешно отключиться', async () => {
    expect.assertions(1);

    await connectFlow.runConnect(connectParameters);
    await connectFlow.runDisconnect();

    expect(sipConnector.isConfigured()).toBe(false);
  });

  it('должен корректно отключиться после задержки', async () => {
    expect.assertions(2);

    await connectFlow.runConnect(connectParameters);

    expect(sipConnector.isConfigured()).toBe(true);

    await connectFlow.runDisconnect();

    await delayPromise(CONNECTION_DELAY);

    expect(sipConnector.isConfigured()).toBe(false);
  });

  it('должен вызвать connect и не вызывать disconnect, если sipConnector не сконфигурирован', async () => {
    expect.assertions(4);

    expect(sipConnector.isConfigured()).toBe(false);

    return connectFlow.runConnect(connectParameters).then(() => {
      expect(disconnectSpy).toHaveBeenCalledTimes(0);
      expect(connectSpy).toHaveBeenCalledTimes(1);
      expect(sipConnector.isConfigured()).toBe(true);
    });
  });

  it('должен выполнить disconnect и затем connect при вызове connect с уже сконфигурированным sipConnector', async () => {
    expect.assertions(4);

    await connectFlow.runConnect(connectParameters);

    expect(connectSpy).toHaveBeenCalledTimes(1);

    await connectFlow.runConnect(connectParameters);

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
    expect(connectSpy).toHaveBeenCalledTimes(2);
    expect(sipConnector.isConfigured()).toBe(true);
  });

  it('не должен запускать подключение если hasReadyForConnection возвращает false', async () => {
    expect.assertions(2);

    hasReadyForConnectionMock.mockReturnValue(false);

    await connectFlow.runConnect(connectParameters, hasReadyForConnectionMock);

    expect(connectSpy).not.toHaveBeenCalled();
    expect(sipConnector.isConfigured()).toBe(false);
  });

  it('должен проксировать метод остановки очереди', async () => {
    expect.assertions(1);

    const stopQueueSpy = jest.spyOn(sipConnector.connectionQueueManager, 'stop');

    connectFlow.stop();

    expect(stopQueueSpy).toHaveBeenCalled();
  });

  describe('обработка ошибок', () => {
    it('должен продолжить подключение даже, если disconnect упал с ошибкой', async () => {
      expect.assertions(2);

      await connectFlow.runConnect(connectParameters);

      jest.clearAllMocks();

      const errorMessage = 'Disconnect is failed';

      disconnectSpy.mockImplementation(async () => {
        throw new Error(errorMessage);
      });

      await connectFlow.runConnect(connectParameters);

      expect(disconnectSpy).toHaveBeenCalledTimes(1);
      expect(connectSpy).toHaveBeenCalledTimes(1);
    });

    it('должен отловить ошибку при неуспешном connect', async () => {
      expect.assertions(2);

      const errorMessage = 'Connect is failed';

      connectSpy.mockImplementation(async () => {
        throw new Error(errorMessage);
      });

      await connectFlow.runConnect(connectParameters).catch((error: unknown) => {
        // eslint-disable-next-line jest/no-conditional-expect
        expect((error as Error).message).toBe(errorMessage);
        // eslint-disable-next-line jest/no-conditional-expect
        expect(sipConnector.isConfigured()).toBe(false);
      });
    });

    it('должен создать новую ошибку если connect упал с неопределенной ошибкой', async () => {
      connectSpy.mockImplementation(async () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'error';
      });

      await connectFlow.runConnect(connectParameters).catch((error: unknown) => {
        // eslint-disable-next-line jest/no-conditional-expect
        expect((error as Error).message).toBe('Failed to connect to server');
      });
    });

    it('должен пробросить ошибку дальше без вызова disconnect, если промис не актуален', async () => {
      expect.assertions(2);

      const runDisconnectSpy = jest.spyOn(connectFlow, 'runDisconnect');

      connectSpy.mockImplementation(async () => {
        await delayPromise(CONNECTION_DELAY);

        return true;
      });

      const connectPromise1 = connectFlow.runConnect(connectParameters);
      const connectPromise2 = connectFlow.runConnect(connectParameters);

      return Promise.allSettled([connectPromise1, connectPromise2]).then((results) => {
        const [result1] = results;

        if (result1.status === 'rejected') {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(hasPromiseIsNotActualError(result1.reason)).toBe(true);
          // Вызывается два раза перед connect
          // eslint-disable-next-line jest/no-conditional-expect
          expect(runDisconnectSpy).toHaveBeenCalledTimes(2);
        }
      });
    });

    it('должен отловить ошибку при неуспешном disconnect', async () => {
      expect.assertions(2);

      const errorMessage = 'Disconnect is failed';

      disconnectSpy.mockImplementation(async () => {
        throw new Error(errorMessage);
      });

      await connectFlow.runConnect(connectParameters);

      expect(sipConnector.isConfigured()).toBe(true);

      return connectFlow.runDisconnect().catch((error: unknown) => {
        // eslint-disable-next-line jest/no-conditional-expect
        expect((error as Error).message).toBe(errorMessage);
      });
    });
  });
});
