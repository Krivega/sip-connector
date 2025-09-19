import delayPromise from '@/__fixtures__/delayPromise';
import { doMockSipConnector } from '@/doMock';

import type ConnectFlow from '../ConnectFlow';
import type { TParametersConnect } from '../types';

const CONNECTION_DELAY = 100;

describe('ConnectFlow', () => {
  const hasReadyForConnectionMock = jest.fn();

  const connectParameters = {
    sipServerUrl: 'test.com',
    sipWebSocketServerURL: 'wss://test.com',
    displayName: 'Test User',
  };

  let sipConnector: ReturnType<typeof doMockSipConnector>;
  let connectFlow: ConnectFlow;

  let disconnectSpy: jest.SpyInstance;
  let connectSpy: jest.SpyInstance;
  let getConnectParameters = jest.fn(async (): Promise<TParametersConnect> => {
    return connectParameters;
  });

  beforeEach(() => {
    sipConnector = doMockSipConnector();

    // @ts-expect-error
    connectFlow = sipConnector.autoConnectorManager.connectFlow;

    hasReadyForConnectionMock.mockReturnValue(true);
    disconnectSpy = jest.spyOn(sipConnector.connectionManager, 'disconnect');
    connectSpy = jest.spyOn(sipConnector.connectionManager, 'connect');
    getConnectParameters = jest.fn(async (): Promise<TParametersConnect> => {
      return connectParameters;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('должен успешно подключиться', async () => {
    expect.assertions(1);

    await connectFlow.runConnect(getConnectParameters);

    expect(sipConnector.isConfigured()).toBe(true);
  });

  it('должен успешно отключиться', async () => {
    expect.assertions(1);

    await connectFlow.runConnect(getConnectParameters);
    await connectFlow.runDisconnect();

    expect(sipConnector.isConfigured()).toBe(false);
  });

  it('должен корректно отключиться после задержки', async () => {
    expect.assertions(2);

    await connectFlow.runConnect(getConnectParameters);

    expect(sipConnector.isConfigured()).toBe(true);

    await connectFlow.runDisconnect();

    await delayPromise(CONNECTION_DELAY);

    expect(sipConnector.isConfigured()).toBe(false);
  });

  it('должен корректно отключиться, если сразу вызвать disconnect после connect', async () => {
    expect.assertions(1);

    connectFlow.runConnect(getConnectParameters).catch(() => {});

    await connectFlow.runDisconnect();

    await delayPromise(CONNECTION_DELAY);

    expect(sipConnector.isConfigured()).toBe(false);
  });

  it('должен корректно подключиться, если вызвать connect, сразу disconnect и снова connect', async () => {
    expect.assertions(1);

    connectFlow.runConnect(getConnectParameters).catch(() => {});
    connectFlow.runDisconnect().catch(() => {});

    await connectFlow.runConnect(getConnectParameters);

    await delayPromise(CONNECTION_DELAY);

    expect(sipConnector.isConfigured()).toBe(true);
  });

  it('должен вызвать connect и не вызывать disconnect, если sipConnector не сконфигурирован', async () => {
    expect.assertions(4);

    expect(sipConnector.isConfigured()).toBe(false);

    await connectFlow.runConnect(getConnectParameters);

    expect(disconnectSpy).toHaveBeenCalledTimes(0);
    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(sipConnector.isConfigured()).toBe(true);
  });

  it('должен выполнить disconnect и затем connect при вызове connect с уже сконфигурированным sipConnector', async () => {
    expect.assertions(4);

    await connectFlow.runConnect(getConnectParameters);

    expect(connectSpy).toHaveBeenCalledTimes(1);

    await connectFlow.runConnect(getConnectParameters);

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
    expect(connectSpy).toHaveBeenCalledTimes(2);
    expect(sipConnector.isConfigured()).toBe(true);
  });

  it('должен выполнить disconnect и connect только для актуального промиса', async () => {
    expect.assertions(5);

    await connectFlow.runConnect(getConnectParameters);

    expect(disconnectSpy).toHaveBeenCalledTimes(0);
    expect(connectSpy).toHaveBeenCalledTimes(1);

    connectFlow.runConnect(getConnectParameters).catch(() => {});
    connectFlow.runConnect(getConnectParameters).catch(() => {});
    connectFlow.runConnect(getConnectParameters).catch(() => {});
    connectFlow.runConnect(getConnectParameters).catch(() => {});

    await delayPromise(CONNECTION_DELAY);

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
    expect(connectSpy).toHaveBeenCalledTimes(2);

    expect(sipConnector.isConfigured()).toBe(true);
  });

  it('не должен запускать подключение если hasReadyForConnection возвращает false', async () => {
    expect.assertions(2);

    hasReadyForConnectionMock.mockReturnValue(false);

    await connectFlow.runConnect(getConnectParameters, hasReadyForConnectionMock);

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

      await connectFlow.runConnect(getConnectParameters);

      jest.clearAllMocks();

      const errorMessage = 'Disconnect is failed';

      disconnectSpy.mockImplementation(async () => {
        throw new Error(errorMessage);
      });

      await connectFlow.runConnect(getConnectParameters);

      expect(disconnectSpy).toHaveBeenCalledTimes(1);
      expect(connectSpy).toHaveBeenCalledTimes(1);
    });

    it('должен отловить ошибку при неуспешном connect', async () => {
      expect.assertions(2);

      const errorMessage = 'Connect is failed';

      connectSpy.mockImplementation(async () => {
        throw new Error(errorMessage);
      });

      await connectFlow.runConnect(getConnectParameters).catch((error: unknown) => {
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

      await connectFlow.runConnect(getConnectParameters).catch((error: unknown) => {
        // eslint-disable-next-line jest/no-conditional-expect
        expect((error as Error).message).toBe('Failed to connect to server');
      });
    });

    it('должен вернуть ошибку, если параметры отсутствуют', async () => {
      expect.assertions(1);

      getConnectParameters.mockResolvedValue(undefined as unknown as TParametersConnect);

      await connectFlow.runConnect(getConnectParameters).catch((error: unknown) => {
        // eslint-disable-next-line jest/no-conditional-expect
        expect((error as Error).message).toBe('Parameters are missing');
      });
    });
  });

  describe('события', () => {
    it('должен вызвать событие CONNECTING при запуске подключения', async () => {
      const handleConnecting = jest.fn();

      sipConnector.autoConnectorManager.on('connecting', handleConnecting);

      await connectFlow.runConnect(getConnectParameters);

      expect(handleConnecting).toHaveBeenCalled();
    });

    it('должен вызвать событие CONNECTED при успешном подключении', async () => {
      const handleConnected = jest.fn();

      sipConnector.autoConnectorManager.on('connected', handleConnected);

      await connectFlow.runConnect(getConnectParameters);

      expect(handleConnected).toHaveBeenCalled();
    });

    it('должен вызвать событие FAILED при неуспешном подключении', async () => {
      const handleFailed = jest.fn();

      connectSpy.mockImplementation(async () => {
        throw new Error('Connect is failed');
      });

      sipConnector.autoConnectorManager.on('failed', handleFailed);

      await connectFlow.runConnect(getConnectParameters).catch(() => {});

      expect(handleFailed).toHaveBeenCalled();
    });

    it('должен вызвать событие FAILED, если параметры отсутствуют', async () => {
      const handleFailed = jest.fn();

      getConnectParameters.mockResolvedValue(undefined as unknown as TParametersConnect);

      sipConnector.autoConnectorManager.on('failed', handleFailed);

      await connectFlow.runConnect(getConnectParameters).catch(() => {});

      expect(handleFailed).toHaveBeenCalled();
    });
  });
});
