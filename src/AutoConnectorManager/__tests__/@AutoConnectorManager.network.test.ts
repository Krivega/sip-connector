import delayPromise from '@/__fixtures__/delayPromise';
import flushPromises from '@/__fixtures__/flushPromises';
import { doMockSipConnector } from '@/doMock';
import AutoConnectorManager from '../@AutoConnectorManager';
import * as browserNetworkEventsSubscriberFactory from '../createBrowserNetworkEventsSubscriber';

import type { SipConnector } from '@/SipConnector';
import type {
  IAutoConnectorOptions,
  INetworkEventsSubscriber,
  TNetworkEventsHandlers,
  TParametersAutoConnect,
} from '../types';

jest.mock('@/logger');

// Fake subscriber: сохраняет handlers и позволяет триггерить сетевые события в тесте.
const createFakeNetworkSubscriber = () => {
  const state: {
    handlers: TNetworkEventsHandlers | undefined;
    subscribeCount: number;
    unsubscribeCount: number;
  } = {
    handlers: undefined,
    subscribeCount: 0,
    unsubscribeCount: 0,
  };

  const subscriber: INetworkEventsSubscriber = {
    subscribe: (handlers) => {
      state.handlers = handlers;
      state.subscribeCount += 1;
    },
    unsubscribe: () => {
      state.handlers = undefined;
      state.unsubscribeCount += 1;
    },
  };

  return { subscriber, state };
};

describe('AutoConnectorManager - Network events', () => {
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

  beforeEach(() => {
    sipConnector = doMockSipConnector();

    baseParameters = {
      getParameters: getConnectParametersMock,
    };
  });

  afterEach(() => {
    manager.stop();
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('использует browser-subscriber по умолчанию, если кастомный не передан', () => {
    const { subscriber, state } = createFakeNetworkSubscriber();
    const createDefaultSubscriberSpy = jest
      .spyOn(browserNetworkEventsSubscriberFactory, 'createBrowserNetworkEventsSubscriber')
      .mockReturnValue(subscriber);

    manager = createManager({ timeoutBetweenAttempts: 10 });
    manager.start(baseParameters);

    expect(createDefaultSubscriberSpy).toHaveBeenCalledTimes(1);
    expect(state.subscribeCount).toBe(1);
  });

  it('не создаёт browser-subscriber по умолчанию, если передан кастомный', () => {
    const { subscriber, state } = createFakeNetworkSubscriber();
    const createDefaultSubscriberSpy = jest.spyOn(
      browserNetworkEventsSubscriberFactory,
      'createBrowserNetworkEventsSubscriber',
    );

    manager = createManager({ networkEventsSubscriber: subscriber, timeoutBetweenAttempts: 10 });
    manager.start(baseParameters);

    expect(createDefaultSubscriberSpy).not.toHaveBeenCalled();
    expect(state.subscribeCount).toBe(1);
  });

  it('не подписывается на сетевые события, если default browser-subscriber недоступен', () => {
    const createDefaultSubscriberSpy = jest
      .spyOn(browserNetworkEventsSubscriberFactory, 'createBrowserNetworkEventsSubscriber')
      .mockReturnValue(undefined);

    manager = createManager({ timeoutBetweenAttempts: 10 });
    manager.start(baseParameters);

    expect(createDefaultSubscriberSpy).toHaveBeenCalledTimes(1);
    expect(() => {
      manager.stop();
    }).not.toThrow();
  });

  it('start: подписывает subscriber на сетевые события', () => {
    const { subscriber, state } = createFakeNetworkSubscriber();

    manager = createManager({ networkEventsSubscriber: subscriber });
    manager.start(baseParameters);

    expect(state.subscribeCount).toBe(1);
    expect(state.handlers).toBeDefined();
  });

  it('повторный start не создаёт повторную подписку', () => {
    const { subscriber, state } = createFakeNetworkSubscriber();

    manager = createManager({ networkEventsSubscriber: subscriber });
    manager.start(baseParameters);
    manager.start(baseParameters);

    expect(state.subscribeCount).toBe(1);
  });

  it('stop: отписывает subscriber от сетевых событий', () => {
    const { subscriber, state } = createFakeNetworkSubscriber();

    manager = createManager({ networkEventsSubscriber: subscriber });
    manager.start(baseParameters);
    manager.stop();

    expect(state.unsubscribeCount).toBe(1);
    expect(state.handlers).toBeUndefined();
  });

  it('onOnline: запрашивает реконнект с причиной network-online', async () => {
    const { subscriber, state } = createFakeNetworkSubscriber();

    manager = createManager({ networkEventsSubscriber: subscriber });
    manager.start(baseParameters);

    await manager.wait('success');

    const connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');
    const disconnectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'disconnect');

    state.handlers?.onOnline();
    await flushPromises();

    // network-online триггерит restart: сначала disconnect текущего, затем новый connect.
    expect(disconnectSpy).toHaveBeenCalled();
    expect(connectSpy).toHaveBeenCalled();
  });

  it('onChange: запрашивает реконнект с причиной network-change', async () => {
    const { subscriber, state } = createFakeNetworkSubscriber();

    manager = createManager({ networkEventsSubscriber: subscriber });
    manager.start(baseParameters);

    await manager.wait('success');

    const connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');

    state.handlers?.onChange();
    await flushPromises();

    expect(connectSpy).toHaveBeenCalled();
  });

  it('onOffline: останавливает соединение после истечения grace-окна', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'queueMicrotask'] });

    const { subscriber, state } = createFakeNetworkSubscriber();

    manager = createManager({
      networkEventsSubscriber: subscriber,
      offlineGraceMs: 500,
    });
    manager.start(baseParameters);

    jest.useRealTimers();
    await manager.wait('success');
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'queueMicrotask'] });

    const stopSpy = jest.spyOn(manager.stateMachine, 'toStop');

    state.handlers?.onOffline();

    // До истечения grace-окна — стоп не вызывается.
    jest.advanceTimersByTime(499);
    expect(stopSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(stopSpy).toHaveBeenCalled();
  });

  it('onOnline отменяет отложенный offline-стоп ("моргнувшая" сеть)', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'queueMicrotask'] });

    const { subscriber, state } = createFakeNetworkSubscriber();

    manager = createManager({
      networkEventsSubscriber: subscriber,
      offlineGraceMs: 500,
    });
    manager.start(baseParameters);

    jest.useRealTimers();
    await manager.wait('success');
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'queueMicrotask'] });

    const stopSpy = jest.spyOn(manager.stateMachine, 'toStop');

    state.handlers?.onOffline();
    jest.advanceTimersByTime(100);

    state.handlers?.onOnline();
    jest.advanceTimersByTime(1000);

    expect(stopSpy).not.toHaveBeenCalled();
  });

  it('после onOffline + истечения grace восстанавливается по onOnline', async () => {
    const { subscriber, state } = createFakeNetworkSubscriber();

    manager = createManager({
      networkEventsSubscriber: subscriber,
      offlineGraceMs: 50,
      timeoutBetweenAttempts: 10,
    });
    manager.start(baseParameters);
    await manager.wait('success');

    state.handlers?.onOffline();
    await delayPromise(80);

    // После grace-окна соединение должно быть прервано.
    expect(sipConnector.isConfigured()).toBe(false);

    const connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');

    state.handlers?.onOnline();
    await manager.wait('success');

    expect(connectSpy).toHaveBeenCalled();
  });
});
