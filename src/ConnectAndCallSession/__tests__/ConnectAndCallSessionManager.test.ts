import flushPromises from '@/__fixtures__/flushPromises';
import { createLoggerMockModule } from '@/__fixtures__/logger.mock';
import resolveDebug from '@/logger';
import ConnectAndCallSessionManager from '../ConnectAndCallSessionManager';
import { EConnectAndCallSessionPhase } from '../types';

import type {
  AutoConnectorManager,
  TAutoConnectStartResult,
  TParametersAutoConnect,
} from '@/AutoConnectorManager';
import type { CallReconnectManager } from '@/CallReconnectManager';
import type { TConnectionConfig } from '@/ConnectionManager';

jest.mock('@/logger', () => {
  return createLoggerMockModule();
});

const mockDebug = (resolveDebug as jest.Mock).mock.results[0].value as jest.Mock;

type THandler = (payload: unknown) => void;

const createEmitter = () => {
  const handlers = new Map<string, Set<THandler>>();

  return {
    on: jest.fn((eventName: string, handler: THandler) => {
      const eventHandlers = handlers.get(eventName) ?? new Set<THandler>();

      eventHandlers.add(handler);
      handlers.set(eventName, eventHandlers);

      return () => {
        eventHandlers.delete(handler);
      };
    }),
    trigger(eventName: string, payload: unknown): void {
      handlers.get(eventName)?.forEach((handler) => {
        handler(payload);
      });
    },
  };
};

const config: TConnectionConfig = {
  authorizationUser: 'user',
  displayName: 'User',
  iceServers: [],
  remoteAddress: '127.0.0.1',
  sipServerIp: 'sip.example.com',
  sipServerUrl: 'wss://sip.example.com',
};

const connection = {
  parameters: {
    displayName: 'User',
    iceServers: [],
    remoteAddress: '127.0.0.1',
    sipServerIp: 'sip.example.com',
    sipServerUrl: 'wss://sip.example.com',
  },
};

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
};

const getStateChangeHandler = (onStateChange: jest.Mock): (() => void) | undefined => {
  const handlers = onStateChange.mock.calls as [() => void][];

  return handlers[0]?.[0];
};

const createFixture = ({
  getConnectionConfig = (): TConnectionConfig | undefined => {
    return config;
  },
  isAutoConnectorActive = false,
  isCallActive = true,
  stopAutoConnect = jest.fn().mockResolvedValue(undefined),
} = {}) => {
  const autoEvents = createEmitter();
  const reconnectEvents = createEmitter();
  let autoConnectorActive = isAutoConnectorActive;
  const startAutoConnect = jest
    .fn<Promise<TAutoConnectStartResult>, [TParametersAutoConnect]>()
    .mockResolvedValue({
      isSuccess: true,
      reason: 'started',
    });
  const endCall = jest.fn().mockResolvedValue(undefined);
  const autoConnectorManager = {
    get isActive() {
      return autoConnectorActive;
    },
    set isActive(value: boolean) {
      autoConnectorActive = value;
    },
    start: startAutoConnect,
    stop: stopAutoConnect,
    on: autoEvents.on,
    stateMachine: {
      onStateChange: jest.fn(() => {
        return () => {};
      }),
    },
  } as unknown as AutoConnectorManager & { isActive: boolean };
  const callReconnectManager = {
    on: reconnectEvents.on,
    disarm: jest.fn(),
    cancelCurrentAttempt: jest.fn(),
  } as unknown as CallReconnectManager;
  const manager = new ConnectAndCallSessionManager({
    autoConnectorManager,
    callReconnectManager,
    connectionManager: {
      getConnectionConfiguration: getConnectionConfig,
    },
    teardown: {
      endCall,
      isCallOngoing: () => {
        return isCallActive;
      },
    },
  });

  return {
    autoConnectorManager,
    autoEvents,
    callReconnectManager,
    endCall,
    onStateChange: autoConnectorManager.stateMachine.onStateChange as jest.Mock,
    manager,
    reconnectEvents,
    startAutoConnect,
    stopAutoConnect,
  };
};

describe('ConnectAndCallSessionManager', () => {
  beforeEach(() => {
    mockDebug.mockClear();
  });
  it('использует function parameters при запуске AutoConnector', async () => {
    const { manager, startAutoConnect } = createFixture();
    const getParameters = jest.fn(async () => {
      return connection.parameters;
    });

    await manager.start({
      connection: {
        parameters: getParameters,
      },
      startCall: async () => {
        return {} as RTCPeerConnection;
      },
    });

    expect(startAutoConnect.mock.calls[0]?.[0].getParameters).toBe(getParameters);
  });

  it('возвращает auto-connect-failed при прерывании из lifecycle события', async () => {
    const { autoEvents, manager } = createFixture();
    const call = createDeferred<RTCPeerConnection>();
    const startPromise = manager.start({
      connection,
      startCall: async () => {
        return call.promise;
      },
    });

    await Promise.resolve();

    autoEvents.trigger('failed-all-attempts', new Error('failed'));
    call.resolve({} as RTCPeerConnection);

    await expect(startPromise).resolves.toMatchObject({
      isSuccessful: false,
      reason: 'auto-connect-failed',
    });
  });

  it('закрывает сессию в фазе calling, если AutoConnector стал inactive', async () => {
    const { autoConnectorManager, manager, onStateChange } = createFixture({ isCallActive: false });
    const call = createDeferred<RTCPeerConnection>();

    const startPromise = manager.start({
      connection,
      startCall: async () => {
        return call.promise;
      },
    });

    await Promise.resolve();

    const stateChangeHandler = getStateChangeHandler(onStateChange);

    autoConnectorManager.isActive = false;
    stateChangeHandler?.();

    call.resolve({} as RTCPeerConnection);

    await expect(startPromise).resolves.toMatchObject({
      isSuccessful: false,
      reason: 'auto-connect-failed',
    });
  });

  it('закрывает сессию в фазе reconnecting, если AutoConnector стал inactive', async () => {
    const { autoConnectorManager, manager, onStateChange, reconnectEvents } = createFixture({
      isCallActive: false,
    });

    await manager.start({
      connection,
      startCall: async () => {
        return {} as RTCPeerConnection;
      },
    });

    reconnectEvents.trigger('termination-classified', { decision: 'redial' });
    expect(manager.phase).toBe(EConnectAndCallSessionPhase.RECONNECTING);

    const stateChangeHandler = getStateChangeHandler(onStateChange);

    autoConnectorManager.isActive = false;
    stateChangeHandler?.();

    await flushPromises();

    expect(await manager.waitUntilClosed()).toBe('auto-connect-failed');
  });

  it('передает object parameters через getParameters в AutoConnector', async () => {
    const { manager, startAutoConnect } = createFixture();

    await manager.start({
      connection,
      startCall: async () => {
        return {} as RTCPeerConnection;
      },
    });

    const getParameters = startAutoConnect.mock.calls[0]?.[0].getParameters;

    await expect(getParameters()).resolves.toEqual(connection.parameters);
  });

  it('запускает AutoConnector и возвращает активную сессию', async () => {
    const { manager, startAutoConnect } = createFixture();
    const peerConnection = {} as RTCPeerConnection;

    const result = await manager.start({
      connection,
      startCall: async () => {
        return peerConnection;
      },
    });

    expect(result).toEqual({
      configuration: config,
      isSuccessful: true,
      peerConnection,
    });
    expect(startAutoConnect).toHaveBeenCalledTimes(1);
    expect(typeof startAutoConnect.mock.calls[0]?.[0].getParameters).toBe('function');
    expect(startAutoConnect.mock.calls[0]?.[0].options).toBeUndefined();
    expect(manager.phase).toBe(EConnectAndCallSessionPhase.ACTIVE);
  });

  it('не захватывает уже активный AutoConnector', async () => {
    const { manager, startAutoConnect, stopAutoConnect } = createFixture({
      isAutoConnectorActive: true,
    });

    const result = await manager.start({
      connection,
      startCall: jest.fn(),
    });

    expect(result).toMatchObject({
      isSuccessful: false,
      reason: 'auto-connector-active',
    });
    expect(startAutoConnect).not.toHaveBeenCalled();
    expect(stopAutoConnect).not.toHaveBeenCalled();
    expect(manager.phase).toBe(EConnectAndCallSessionPhase.CLOSED);
  });

  it('закрывает сессию, если конфигурация недоступна после auto-connect', async () => {
    const { manager, stopAutoConnect } = createFixture({
      getConnectionConfig: (): TConnectionConfig | undefined => {
        return undefined;
      },
    });

    await expect(
      manager.start({
        connection,
        startCall: jest.fn(),
      }),
    ).rejects.toThrow('Connection configuration is unavailable after auto-connect');

    expect(stopAutoConnect).toHaveBeenCalledTimes(1);
    expect(await manager.waitUntilClosed()).toBe('auto-connect-failed');
  });

  it('закрывает соединение после ошибки первого звонка', async () => {
    const { manager, stopAutoConnect } = createFixture({ isCallActive: false });
    const error = new Error('Call failed');

    await expect(
      manager.start({
        connection,
        startCall: async () => {
          throw error;
        },
      }),
    ).rejects.toBe(error);

    expect(stopAutoConnect).toHaveBeenCalledTimes(1);
    expect(await manager.waitUntilClosed()).toBe('initial-call-failed');
  });

  it('сохраняет соединение во время redial и закрывает вручную', async () => {
    const { callReconnectManager, endCall, manager, reconnectEvents, stopAutoConnect } =
      createFixture();

    await manager.start({
      connection,
      startCall: async () => {
        return {} as RTCPeerConnection;
      },
    });

    reconnectEvents.trigger('termination-classified', { decision: 'redial' });

    expect(manager.phase).toBe(EConnectAndCallSessionPhase.RECONNECTING);
    expect(stopAutoConnect).not.toHaveBeenCalled();

    reconnectEvents.trigger('attempt-succeeded', { attempt: 1 });
    expect(manager.phase).toBe(EConnectAndCallSessionPhase.ACTIVE);

    await manager.hangUp();

    expect(callReconnectManager.disarm).toHaveBeenCalledWith('manual');
    expect(callReconnectManager.cancelCurrentAttempt).toHaveBeenCalled();
    expect(endCall).toHaveBeenCalled();
    expect(stopAutoConnect).toHaveBeenCalledTimes(1);
    expect(await manager.waitUntilClosed()).toBe('manual');
  });

  it('делает cleanup один раз при конкурирующих terminal-событиях', async () => {
    const { manager, reconnectEvents, stopAutoConnect } = createFixture({
      isCallActive: false,
    });

    await manager.start({
      connection,
      startCall: async () => {
        return {} as RTCPeerConnection;
      },
    });

    reconnectEvents.trigger('termination-classified', { decision: 'finish' });
    reconnectEvents.trigger('terminal', { reason: 'limit-reached', attempts: 3 });

    await manager.waitUntilClosed();

    expect(stopAutoConnect).toHaveBeenCalledTimes(1);
  });

  it('отменяет запуск во время подключения', async () => {
    const { manager, startAutoConnect, stopAutoConnect } = createFixture({
      isCallActive: false,
    });
    const autoConnect = createDeferred<TAutoConnectStartResult>();

    startAutoConnect.mockReturnValue(autoConnect.promise);

    const startPromise = manager.start({
      connection,
      startCall: jest.fn(),
    });
    const disconnectPromise = manager.disconnect();

    autoConnect.resolve({
      isSuccess: false,
      reason: 'stop-attempts-by-error',
      error: new Error('Stopped manually'),
    });

    await expect(startPromise).resolves.toMatchObject({
      isSuccessful: false,
      reason: 'cancelled',
    });
    await disconnectPromise;

    expect(stopAutoConnect).toHaveBeenCalledTimes(1);
    expect(await manager.waitUntilClosed()).toBe('manual');
  });

  it('не возвращает success после отмены запуска звонка', async () => {
    const { endCall, manager, stopAutoConnect } = createFixture();
    const call = createDeferred<RTCPeerConnection>();
    const startPromise = manager.start({
      connection,
      startCall: async () => {
        return call.promise;
      },
    });

    await Promise.resolve();

    const hangUpPromise = manager.hangUp();

    call.resolve({} as RTCPeerConnection);

    await expect(startPromise).resolves.toMatchObject({
      isSuccessful: false,
      reason: 'cancelled',
    });
    await hangUpPromise;

    expect(endCall).toHaveBeenCalledTimes(1);
    expect(stopAutoConnect).toHaveBeenCalledTimes(1);
  });

  it('выполняет cleanup один раз для одновременных hangUp и disconnect', async () => {
    const { endCall, manager, stopAutoConnect } = createFixture();

    await manager.start({
      connection,
      startCall: async () => {
        return {} as RTCPeerConnection;
      },
    });

    await Promise.all([manager.hangUp(), manager.disconnect()]);

    expect(endCall).toHaveBeenCalledTimes(1);
    expect(stopAutoConnect).toHaveBeenCalledTimes(1);
    expect(await manager.waitUntilClosed()).toBe('manual');
  });

  it('возвращает failure после отмены, если startCall завершился ошибкой', async () => {
    const { endCall, manager, stopAutoConnect } = createFixture();
    const call = createDeferred<RTCPeerConnection>();
    const callError = new Error('Call rejected');
    const startPromise = manager.start({
      connection,
      startCall: async () => {
        return call.promise;
      },
    });

    await Promise.resolve();

    const hangUpPromise = manager.hangUp();

    call.reject(callError);

    await expect(startPromise).resolves.toMatchObject({
      error: callError,
      isSuccessful: false,
      reason: 'cancelled',
    });
    await hangUpPromise;

    expect(endCall).toHaveBeenCalledTimes(1);
    expect(stopAutoConnect).toHaveBeenCalledTimes(1);
  });

  it('пробрасывает ошибку первого звонка, даже если cleanup завершился ошибкой', async () => {
    const callError = new Error('Call failed');
    const cleanupError = new Error('Stop failed');
    const { manager, stopAutoConnect } = createFixture({
      isCallActive: false,
      stopAutoConnect: jest.fn().mockRejectedValue(cleanupError),
    });

    await expect(
      manager.start({
        connection,
        startCall: async () => {
          throw callError;
        },
      }),
    ).rejects.toBe(callError);

    expect(stopAutoConnect).toHaveBeenCalledTimes(1);
    expect(mockDebug).toHaveBeenCalledWith(
      'cleanup after initial call failure failed',
      cleanupError,
    );
  });

  it('закрывает сессию при auto-connect lifecycle событиях', async () => {
    const { autoEvents, manager, stopAutoConnect } = createFixture({
      isCallActive: false,
    });

    await manager.start({
      connection,
      startCall: async () => {
        return {} as RTCPeerConnection;
      },
    });

    autoEvents.trigger('failed-all-attempts', new Error('failed all'));
    await manager.waitUntilClosed();

    expect(stopAutoConnect).toHaveBeenCalledTimes(1);

    const stopAttemptsFixture = createFixture({ isCallActive: false });

    await stopAttemptsFixture.manager.start({
      connection,
      startCall: async () => {
        return {} as RTCPeerConnection;
      },
    });

    stopAttemptsFixture.autoEvents.trigger('stop-attempts-by-error', new Error('stopped'));
    await stopAttemptsFixture.manager.waitUntilClosed();

    const limitFixture = createFixture({ isCallActive: false });

    await limitFixture.manager.start({
      connection,
      startCall: async () => {
        return {} as RTCPeerConnection;
      },
    });

    limitFixture.autoEvents.trigger('limit-reached-attempts', new Error('limit'));
    await limitFixture.manager.waitUntilClosed();
  });

  it('не закрывает сессию, если AutoConnector остаётся active', async () => {
    const { autoConnectorManager, manager, onStateChange, stopAutoConnect } = createFixture({
      isCallActive: false,
    });

    await manager.start({
      connection,
      startCall: async () => {
        return {} as RTCPeerConnection;
      },
    });

    const stateChangeHandler = getStateChangeHandler(onStateChange);

    autoConnectorManager.isActive = true;
    stateChangeHandler?.();

    await flushPromises();

    expect(stopAutoConnect).not.toHaveBeenCalled();
    expect(manager.phase).toBe(EConnectAndCallSessionPhase.ACTIVE);
  });

  it('закрывает сессию, если AutoConnector стал inactive во время звонка', async () => {
    const { autoConnectorManager, manager, onStateChange, stopAutoConnect } = createFixture({
      isCallActive: false,
    });

    await manager.start({
      connection,
      startCall: async () => {
        return {} as RTCPeerConnection;
      },
    });

    const stateChangeHandler = getStateChangeHandler(onStateChange);

    autoConnectorManager.isActive = false;
    stateChangeHandler?.();

    await flushPromises();

    expect(stopAutoConnect).toHaveBeenCalledTimes(1);
    expect(await manager.waitUntilClosed()).toBe('auto-connect-failed');
    expect(manager.phase).toBe(EConnectAndCallSessionPhase.CLOSED);
  });

  it('логирует ошибку background finalization', async () => {
    const backgroundError = new Error('Background cleanup failed');
    const { manager, reconnectEvents, stopAutoConnect } = createFixture({
      isCallActive: false,
      stopAutoConnect: jest.fn().mockRejectedValue(backgroundError),
    });

    await manager.start({
      connection,
      startCall: async () => {
        return {} as RTCPeerConnection;
      },
    });

    reconnectEvents.trigger('termination-classified', { decision: 'finish' });

    await flushPromises();

    expect(mockDebug).toHaveBeenCalledWith('background finalization failed', backgroundError);
    expect(stopAutoConnect).toHaveBeenCalledTimes(1);
  });

  it('возвращает cleanupError при прерванном старте с ошибкой finalize', async () => {
    const cleanupError = new Error('Finalize failed');
    const { endCall, manager } = createFixture();
    const call = createDeferred<RTCPeerConnection>();

    endCall.mockRejectedValue(cleanupError);

    const startPromise = manager.start({
      connection,
      startCall: async () => {
        return call.promise;
      },
    });

    await Promise.resolve();

    const hangUpPromise = manager.hangUp();

    call.resolve({} as RTCPeerConnection);

    await expect(startPromise).resolves.toMatchObject({
      error: cleanupError,
      isSuccessful: false,
      reason: 'cancelled',
    });
    await expect(hangUpPromise).rejects.toBe(cleanupError);
  });

  it('останавливает AutoConnector и закрывается при ошибке завершения звонка', async () => {
    const { endCall, manager, stopAutoConnect } = createFixture();
    const error = new Error('End call failed');

    endCall.mockRejectedValue(error);

    await manager.start({
      connection,
      startCall: async () => {
        return {} as RTCPeerConnection;
      },
    });

    await expect(manager.hangUp()).rejects.toBe(error);

    expect(stopAutoConnect).toHaveBeenCalledTimes(1);
    expect(manager.phase).toBe(EConnectAndCallSessionPhase.CLOSED);
    expect(await manager.waitUntilClosed()).toBe('manual');
  });
});
