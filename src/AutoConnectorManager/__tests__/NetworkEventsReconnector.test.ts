import NetworkEventsReconnector from '../NetworkEventsReconnector';

import type {
  INetworkEventsSubscriber,
  TNetworkEventsHandlers,
  TParametersAutoConnect,
} from '../types';

describe('NetworkEventsReconnector', () => {
  it('не запрашивает reconnect без parameters', () => {
    let handlers: TNetworkEventsHandlers | undefined;
    const subscriber: INetworkEventsSubscriber = {
      subscribe: (nextHandlers) => {
        handlers = nextHandlers;
      },
      unsubscribe: () => {
        handlers = undefined;
      },
    };
    const requestReconnect = jest.fn();
    const stopConnection = jest.fn();
    const reconnector = new NetworkEventsReconnector({
      subscriber,
      requestReconnect,
      stopConnection,
    });

    // Имитируем входящее событие в состоянии, когда parameters отсутствуют.
    (
      reconnector as unknown as { requestReconnectIfAvailable: (reason: 'network-change') => void }
    ).requestReconnectIfAvailable('network-change');

    handlers?.onChange();

    expect(requestReconnect).not.toHaveBeenCalled();
  });

  it('по умолчанию использует DEFAULT_OFFLINE_GRACE_MS', () => {
    jest.useFakeTimers();

    const subscriber: INetworkEventsSubscriber = {
      subscribe: (handlers) => {
        handlers.onOffline();
      },
      unsubscribe: jest.fn(),
    };
    const requestReconnect = jest.fn();
    const stopConnection = jest.fn();
    const reconnector = new NetworkEventsReconnector({
      subscriber,
      requestReconnect,
      stopConnection,
    });
    const parameters: TParametersAutoConnect = {
      getParameters: async () => {
        return {} as never;
      },
    };

    reconnector.start(parameters);
    jest.advanceTimersByTime(1999);
    expect(stopConnection).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(stopConnection).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });
});
