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

  it('должен проксировать метод stop', async () => {
    const stopSpy = jest.spyOn(connectionQueueManager, 'stop');

    connectionQueueManager.stop();

    expect(stopSpy).toHaveBeenCalled();
  });

  it('должен проксировать метод run', async () => {
    const runSpy = jest.spyOn(connectionQueueManager, 'run');

    await connectionQueueManager.run(async () => {
      return undefined;
    });

    expect(runSpy).toHaveBeenCalled();
  });
});
