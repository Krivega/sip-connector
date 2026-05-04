import NetworkEventsReconnector from '../NetworkEventsReconnector';

import type {
  INetworkEventsSubscriber,
  TNetworkEventsHandlers,
  TNetworkProbe,
  TParametersAutoConnect,
} from '../types';

const createSubscriber = () => {
  let handlers: TNetworkEventsHandlers | undefined;
  const subscriber: INetworkEventsSubscriber = {
    subscribe: (nextHandlers) => {
      handlers = nextHandlers;
    },
    unsubscribe: () => {
      handlers = undefined;
    },
  };

  return {
    subscriber,
    emit: (event: keyof TNetworkEventsHandlers) => {
      handlers?.[event]();
    },
    getHandlers: () => {
      return handlers;
    },
  };
};

const createParameters = (): TParametersAutoConnect => {
  return {
    getParameters: async () => {
      return {} as never;
    },
  };
};

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('NetworkEventsReconnector', () => {
  describe('start subscribe guard', () => {
    it('повторный start при активной подписке не вызывает subscribe второй раз', () => {
      const subscribe = jest.fn();
      const subscriber: INetworkEventsSubscriber = {
        subscribe,
        unsubscribe: jest.fn(),
      };
      const reconnector = new NetworkEventsReconnector({
        subscriber,
        onChangePolicy: 'reconnect',
        requestReconnect: jest.fn(),
        stopConnection: jest.fn(),
      });

      reconnector.start(createParameters());
      reconnector.start(createParameters());

      expect(subscribe).toHaveBeenCalledTimes(1);
    });

    it('повторный start обновляет parameters, даже если подписка уже активна', () => {
      const { subscriber, emit } = createSubscriber();
      const requestReconnect = jest.fn();
      const firstParameters = createParameters();
      const secondParameters = createParameters();
      const reconnector = new NetworkEventsReconnector({
        subscriber,
        onChangePolicy: 'reconnect',
        requestReconnect,
        stopConnection: jest.fn(),
      });

      reconnector.start(firstParameters);
      reconnector.start(secondParameters);
      emit('onChange');

      expect(requestReconnect).toHaveBeenCalledWith(secondParameters, 'network-change');
    });
  });

  it('не запрашивает reconnect после stop (parameters сброшены)', () => {
    const { subscriber, emit } = createSubscriber();
    const requestReconnect = jest.fn();
    const reconnector = new NetworkEventsReconnector({
      subscriber,
      onChangePolicy: 'reconnect',
      requestReconnect,
      stopConnection: jest.fn(),
    });

    reconnector.start(createParameters());
    emit('onChange');
    expect(requestReconnect).toHaveBeenCalledTimes(1);

    reconnector.stop();
    // После stop handlers отписаны — прямой вызов приватного метода подтверждает,
    // что внутри есть guard на отсутствие parameters.
    (
      reconnector as unknown as { requestReconnectIfAvailable: (reason: 'network-change') => void }
    ).requestReconnectIfAvailable('network-change');

    expect(requestReconnect).toHaveBeenCalledTimes(1);
  });

  it('по умолчанию использует DEFAULT_OFFLINE_GRACE_MS (2000ms)', () => {
    jest.useFakeTimers();

    try {
      const subscriber: INetworkEventsSubscriber = {
        subscribe: (handlers) => {
          handlers.onOffline();
        },
        unsubscribe: jest.fn(),
      };
      const stopConnection = jest.fn();
      const reconnector = new NetworkEventsReconnector({
        subscriber,
        requestReconnect: jest.fn(),
        stopConnection,
      });

      reconnector.start(createParameters());
      jest.advanceTimersByTime(1999);
      expect(stopConnection).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(stopConnection).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  describe('policy=reconnect', () => {
    it('onChange безусловно вызывает requestReconnect', () => {
      const { subscriber, emit } = createSubscriber();
      const requestReconnect = jest.fn();
      const reconnector = new NetworkEventsReconnector({
        subscriber,
        onChangePolicy: 'reconnect',
        requestReconnect,
        stopConnection: jest.fn(),
      });

      reconnector.start(createParameters());
      emit('onChange');

      expect(requestReconnect).toHaveBeenCalledWith(expect.any(Object), 'network-change');
    });

    it('onOnline безусловно вызывает requestReconnect', () => {
      const { subscriber, emit } = createSubscriber();
      const requestReconnect = jest.fn();
      const reconnector = new NetworkEventsReconnector({
        subscriber,
        onOnlinePolicy: 'reconnect',
        requestReconnect,
        stopConnection: jest.fn(),
      });

      reconnector.start(createParameters());
      emit('onOnline');

      expect(requestReconnect).toHaveBeenCalledWith(expect.any(Object), 'network-online');
    });
  });

  describe('policy=ignore', () => {
    it('onChange с ignore не вызывает reconnect', () => {
      const { subscriber, emit } = createSubscriber();
      const requestReconnect = jest.fn();
      const probe = jest.fn<ReturnType<TNetworkProbe>, []>();
      const reconnector = new NetworkEventsReconnector({
        subscriber,
        onChangePolicy: 'ignore',
        probe,
        requestReconnect,
        stopConnection: jest.fn(),
      });

      reconnector.start(createParameters());
      emit('onChange');

      expect(requestReconnect).not.toHaveBeenCalled();
      expect(probe).not.toHaveBeenCalled();
    });

    it('onOnline с ignore не вызывает reconnect', () => {
      const { subscriber, emit } = createSubscriber();
      const requestReconnect = jest.fn();
      const reconnector = new NetworkEventsReconnector({
        subscriber,
        onOnlinePolicy: 'ignore',
        requestReconnect,
        stopConnection: jest.fn(),
      });

      reconnector.start(createParameters());
      emit('onOnline');

      expect(requestReconnect).not.toHaveBeenCalled();
    });
  });

  describe('policy=probe', () => {
    it('probe=true — reconnect не запрашивается', async () => {
      const { subscriber, emit } = createSubscriber();
      const requestReconnect = jest.fn();
      const probe = jest.fn<ReturnType<TNetworkProbe>, []>().mockResolvedValue(true);
      const reconnector = new NetworkEventsReconnector({
        subscriber,
        onChangePolicy: 'probe',
        probe,
        requestReconnect,
        stopConnection: jest.fn(),
      });

      reconnector.start(createParameters());
      emit('onChange');
      await flushMicrotasks();

      expect(probe).toHaveBeenCalledTimes(1);
      expect(requestReconnect).not.toHaveBeenCalled();
    });

    it('probe=false — запрашивается reconnect', async () => {
      const { subscriber, emit } = createSubscriber();
      const requestReconnect = jest.fn();
      const probe = jest.fn<ReturnType<TNetworkProbe>, []>().mockResolvedValue(false);
      const reconnector = new NetworkEventsReconnector({
        subscriber,
        onOnlinePolicy: 'probe',
        probe,
        requestReconnect,
        stopConnection: jest.fn(),
      });

      reconnector.start(createParameters());
      emit('onOnline');
      await flushMicrotasks();

      expect(probe).toHaveBeenCalledTimes(1);
      expect(requestReconnect).toHaveBeenCalledWith(expect.any(Object), 'network-online');
    });

    it('probe бросает исключение — fallback на reconnect', async () => {
      const { subscriber, emit } = createSubscriber();
      const requestReconnect = jest.fn();
      const probe = jest
        .fn<ReturnType<TNetworkProbe>, []>()
        .mockRejectedValue(new Error('probe failed'));
      const reconnector = new NetworkEventsReconnector({
        subscriber,
        onChangePolicy: 'probe',
        probe,
        requestReconnect,
        stopConnection: jest.fn(),
      });

      reconnector.start(createParameters());
      emit('onChange');
      await flushMicrotasks();

      expect(requestReconnect).toHaveBeenCalledWith(expect.any(Object), 'network-change');
    });

    it('параллельные события коалесцируются: probe вызывается один раз', async () => {
      const { subscriber, emit } = createSubscriber();
      const requestReconnect = jest.fn();
      let resolveProbe: (value: boolean) => void = () => {};
      const probe = jest.fn<ReturnType<TNetworkProbe>, []>().mockImplementation(async () => {
        return new Promise<boolean>((resolve) => {
          resolveProbe = resolve;
        });
      });
      const reconnector = new NetworkEventsReconnector({
        subscriber,
        onChangePolicy: 'probe',
        probe,
        requestReconnect,
        stopConnection: jest.fn(),
      });

      reconnector.start(createParameters());
      emit('onChange');
      emit('onChange');
      emit('onChange');

      resolveProbe(true);
      await flushMicrotasks();

      expect(probe).toHaveBeenCalledTimes(1);
      expect(requestReconnect).not.toHaveBeenCalled();
    });

    it('политика=probe, но probe не передан — fallback на reconnect', () => {
      const { subscriber, emit } = createSubscriber();
      const requestReconnect = jest.fn();
      const reconnector = new NetworkEventsReconnector({
        subscriber,
        onChangePolicy: 'probe',
        requestReconnect,
        stopConnection: jest.fn(),
      });

      reconnector.start(createParameters());
      emit('onChange');

      expect(requestReconnect).toHaveBeenCalledWith(expect.any(Object), 'network-change');
    });
  });

  it('onOffline отменяет ранее запущенный offline-таймер', () => {
    jest.useFakeTimers();

    try {
      const { subscriber, emit } = createSubscriber();
      const stopConnection = jest.fn();
      const reconnector = new NetworkEventsReconnector({
        subscriber,
        offlineGraceMs: 1000,
        requestReconnect: jest.fn(),
        stopConnection,
      });

      reconnector.start(createParameters());
      emit('onOffline');
      jest.advanceTimersByTime(500);
      emit('onOffline'); // перезапускает таймер
      jest.advanceTimersByTime(500);
      expect(stopConnection).not.toHaveBeenCalled();
      jest.advanceTimersByTime(500);
      expect(stopConnection).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('onOnline во время offline-grace отменяет таймер', () => {
    jest.useFakeTimers();

    try {
      const { subscriber, emit } = createSubscriber();
      const stopConnection = jest.fn();
      const reconnector = new NetworkEventsReconnector({
        subscriber,
        offlineGraceMs: 1000,
        onOnlinePolicy: 'reconnect',
        requestReconnect: jest.fn(),
        stopConnection,
      });

      reconnector.start(createParameters());
      emit('onOffline');
      jest.advanceTimersByTime(500);
      emit('onOnline');
      jest.advanceTimersByTime(1000);

      expect(stopConnection).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('onChange во время offline-grace НЕ отменяет таймер', () => {
    jest.useFakeTimers();

    try {
      const { subscriber, emit } = createSubscriber();
      const stopConnection = jest.fn();
      const reconnector = new NetworkEventsReconnector({
        subscriber,
        offlineGraceMs: 1000,
        onChangePolicy: 'ignore',
        requestReconnect: jest.fn(),
        stopConnection,
      });

      reconnector.start(createParameters());
      emit('onOffline');
      jest.advanceTimersByTime(500);
      emit('onChange');
      jest.advanceTimersByTime(500);

      expect(stopConnection).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
