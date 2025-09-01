import ConnectionStackManager from '../@ConnectionStackManager';

import type { ConnectionManager } from '@/ConnectionManager';

describe('ConnectionStackManager', () => {
  let connectionManager: ConnectionManager;
  let stackedManager: ConnectionStackManager;
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

    stackedManager = new ConnectionStackManager({
      connectionManager,
    });

    // @ts-expect-error приватное поле
    stackRunSpy = jest.spyOn(stackedManager.stackPromises, 'run');
  });

  afterEach(() => {
    stackRunSpy.mockRestore();
  });

  it('должен выполнять connect через стек', async () => {
    const mockResult = {};
    const connectParams = {
      sipServerUrl: 'test.com',
      sipWebSocketServerURL: 'wss://test.com',
    };

    (connectionManager.connect as jest.Mock).mockResolvedValue(mockResult);

    const result = await stackedManager.connect(connectParams);

    expect(stackRunSpy).toHaveBeenCalled();
    expect(connectionManager.connect).toHaveBeenCalledWith(connectParams);
    expect(result).toBe(mockResult);
  });

  it('должен выполнять disconnect через стек', async () => {
    (connectionManager.disconnect as jest.Mock).mockResolvedValue(undefined);

    await stackedManager.disconnect();

    expect(stackRunSpy).toHaveBeenCalled();
    expect(connectionManager.disconnect).toHaveBeenCalled();
  });

  it('должен выполнять register через стек', async () => {
    const mockEvent = {};

    (connectionManager.register as jest.Mock).mockResolvedValue(mockEvent);

    const result = await stackedManager.register();

    expect(stackRunSpy).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(connectionManager.register).toHaveBeenCalled();
    expect(result).toBe(mockEvent);
  });

  it('должен выполнять unregister через стек', async () => {
    const mockEvent = {};

    (connectionManager.unregister as jest.Mock).mockResolvedValue(mockEvent);

    const result = await stackedManager.unregister();

    expect(stackRunSpy).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(connectionManager.unregister).toHaveBeenCalled();
    expect(result).toBe(mockEvent);
  });

  it('должен выполнять tryRegister через стек', async () => {
    const mockEvent = {};

    (connectionManager.tryRegister as jest.Mock).mockResolvedValue(mockEvent);

    const result = await stackedManager.tryRegister();

    expect(stackRunSpy).toHaveBeenCalled();
    expect(connectionManager.tryRegister).toHaveBeenCalled();
    expect(result).toBe(mockEvent);
  });

  it('должен выполнять checkTelephony через стек', async () => {
    const params = {
      displayName: 'test',
      sipServerUrl: 'test.com',
      sipWebSocketServerURL: 'wss://test.com',
    };

    (connectionManager.checkTelephony as jest.Mock).mockResolvedValue(undefined);

    await stackedManager.checkTelephony(params);

    expect(stackRunSpy).toHaveBeenCalled();
    expect(connectionManager.checkTelephony).toHaveBeenCalledWith(params);
  });

  it('должен выполнять sendOptions через стек', async () => {
    const target = 'sip:test@example.com';
    const body = 'test body';

    (connectionManager.sendOptions as jest.Mock).mockResolvedValue(undefined);

    await stackedManager.sendOptions(target, body);

    expect(stackRunSpy).toHaveBeenCalled();
    expect(connectionManager.sendOptions).toHaveBeenCalledWith(target, body);
  });

  it('должен выполнять ping через стек', async () => {
    const body = 'test body';

    (connectionManager.ping as jest.Mock).mockResolvedValue(undefined);

    await stackedManager.ping(body);

    expect(stackRunSpy).toHaveBeenCalled();
    expect(connectionManager.ping).toHaveBeenCalledWith(body);
  });

  it('должен выполнять set через стек', async () => {
    const params = { displayName: 'new name' };

    (connectionManager.set as jest.Mock).mockResolvedValue(true);

    const result = await stackedManager.set(params);

    expect(stackRunSpy).toHaveBeenCalled();
    expect(connectionManager.set).toHaveBeenCalledWith(params);
    expect(result).toBe(true);
  });
});
