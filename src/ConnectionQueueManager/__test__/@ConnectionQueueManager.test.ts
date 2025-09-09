import ConnectionQueueManager from '../@ConnectionQueueManager';

import type { ConnectionManager } from '@/ConnectionManager';

describe('ConnectionQueueManager', () => {
  let connectionManager: ConnectionManager;
  let connectionQueueManager: ConnectionQueueManager;
  let stackRunSpy: jest.SpyInstance;

  beforeEach(() => {
    connectionManager = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      register: jest.fn(),
      unregister: jest.fn(),
      tryRegister: jest.fn(),
      checkTelephony: jest.fn(),
      sendOptions: jest.fn(),
      ping: jest.fn(),
      set: jest.fn(),
    } as unknown as ConnectionManager;

    connectionQueueManager = new ConnectionQueueManager({
      connectionManager,
    });

    // @ts-expect-error приватное поле
    stackRunSpy = jest.spyOn(connectionQueueManager.stackPromises, 'run');
  });

  afterEach(() => {
    stackRunSpy.mockRestore();
  });

  it('должен выполнять connect через очередь', async () => {
    const mockResult = {};
    const connectParams = {
      sipServerUrl: 'test.com',
      sipWebSocketServerURL: 'wss://test.com',
    };

    (connectionManager.connect as jest.Mock).mockResolvedValue(mockResult);

    const result = await connectionQueueManager.connect(connectParams);

    expect(stackRunSpy).toHaveBeenCalled();
    expect(connectionManager.connect).toHaveBeenCalledWith(connectParams);
    expect(result).toBe(mockResult);
  });

  it('должен выполнять disconnect через очередь', async () => {
    (connectionManager.disconnect as jest.Mock).mockResolvedValue(undefined);

    await connectionQueueManager.disconnect();

    expect(stackRunSpy).toHaveBeenCalled();
    expect(connectionManager.disconnect).toHaveBeenCalled();
  });

  it('должен выполнять register через очередь', async () => {
    const mockEvent = {};

    (connectionManager.register as jest.Mock).mockResolvedValue(mockEvent);

    const result = await connectionQueueManager.register();

    expect(stackRunSpy).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(connectionManager.register).toHaveBeenCalled();
    expect(result).toBe(mockEvent);
  });

  it('должен выполнять unregister через очередь', async () => {
    const mockEvent = {};

    (connectionManager.unregister as jest.Mock).mockResolvedValue(mockEvent);

    const result = await connectionQueueManager.unregister();

    expect(stackRunSpy).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(connectionManager.unregister).toHaveBeenCalled();
    expect(result).toBe(mockEvent);
  });

  it('должен выполнять tryRegister через очередь', async () => {
    const mockEvent = {};

    (connectionManager.tryRegister as jest.Mock).mockResolvedValue(mockEvent);

    const result = await connectionQueueManager.tryRegister();

    expect(stackRunSpy).toHaveBeenCalled();
    expect(connectionManager.tryRegister).toHaveBeenCalled();
    expect(result).toBe(mockEvent);
  });
});
