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
      displayName: 'Any Name',
      sipServerIp: 'test.com',
      sipServerUrl: 'wss://test.com',
      remoteAddress: '10.10.10.10',
      iceServers: [],
    };

    const getParameters = async () => {
      return connectParams;
    };

    (connectionManager.connect as jest.Mock).mockResolvedValue(mockResult);

    const result = await connectionQueueManager.connect(getParameters);

    expect(stackRunSpy).toHaveBeenCalled();
    expect(connectionManager.connect).toHaveBeenCalledWith(getParameters);
    expect(result).toBe(mockResult);
  });

  it('должен выполнять disconnect сразу и останавливать очередь', async () => {
    const stopSpy = jest.spyOn(connectionQueueManager, 'stop');

    (connectionManager.disconnect as jest.Mock).mockResolvedValue(undefined);

    await connectionQueueManager.disconnect();

    expect(stopSpy).toHaveBeenCalled();
    expect(stackRunSpy).not.toHaveBeenCalled();
    expect(connectionManager.disconnect).toHaveBeenCalled();

    stopSpy.mockRestore();
  });

  it('должен выполнять disconnect, не дожидаясь завершения активного connect', async () => {
    const mockResult = {};
    const connectParams = {
      displayName: 'Any Name',
      sipServerIp: 'test.com',
      sipServerUrl: 'wss://test.com',
      remoteAddress: '10.10.10.10',
      iceServers: [],
    };
    let resolveConnect!: (value: unknown) => void;

    (connectionManager.connect as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveConnect = resolve;
      }),
    );
    (connectionManager.disconnect as jest.Mock).mockResolvedValue(undefined);

    const connectPromise = connectionQueueManager.connect(async () => {
      return connectParams;
    });

    await Promise.resolve();

    const disconnectPromise = connectionQueueManager.disconnect();

    await Promise.resolve();

    expect(connectionManager.disconnect).toHaveBeenCalledTimes(1);

    resolveConnect(mockResult);

    await Promise.allSettled([connectPromise, disconnectPromise]);
  });

  it('должен проксировать метод stop', async () => {
    const stopSpy = jest.spyOn(connectionQueueManager, 'stop');

    connectionQueueManager.stop();

    expect(stopSpy).toHaveBeenCalled();
  });
});
