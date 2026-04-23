import { createBrowserNetworkEventsSubscriber } from '../createBrowserNetworkEventsSubscriber';

import type { TNetworkEventsHandlers } from '../types';

type TEventName = 'online' | 'offline' | 'change';
type TEventListener = EventListener;

const createEventEmitterTarget = () => {
  const listeners: Record<TEventName, Set<TEventListener>> = {
    online: new Set<TEventListener>(),
    offline: new Set<TEventListener>(),
    change: new Set<TEventListener>(),
  };

  const addEventListener = jest.fn(
    (event: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener !== 'function') {
        return;
      }

      if (event === 'online' || event === 'offline' || event === 'change') {
        listeners[event].add(listener);
      }
    },
  );

  const removeEventListener = jest.fn(
    (event: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener !== 'function') {
        return;
      }

      if (event === 'online' || event === 'offline' || event === 'change') {
        listeners[event].delete(listener);
      }
    },
  );

  const emit = (event: TEventName) => {
    listeners[event].forEach((listener) => {
      listener(new Event(event));
    });
  };

  return {
    target: {
      addEventListener,
      removeEventListener,
    },
    emit,
    listeners,
  };
};

describe('createBrowserNetworkEventsSubscriber', () => {
  it('возвращает undefined, если windowRef явно передан как undefined', () => {
    const subscriber = createBrowserNetworkEventsSubscriber({
      windowRef: undefined,
    });

    expect(subscriber).toBeUndefined();
  });

  it('подписывается на online/offline/change и проксирует события в handlers', () => {
    const windowTarget = createEventEmitterTarget();
    const connectionTarget = createEventEmitterTarget();
    const handlers: TNetworkEventsHandlers = {
      onOnline: jest.fn(),
      onOffline: jest.fn(),
      onChange: jest.fn(),
    };

    const subscriber = createBrowserNetworkEventsSubscriber({
      windowRef: windowTarget.target as unknown as Window,
      navigatorRef: {
        connection: connectionTarget.target as unknown as EventTarget,
      } as Navigator & { connection?: EventTarget },
    });

    subscriber?.subscribe(handlers);

    windowTarget.emit('online');
    windowTarget.emit('offline');
    connectionTarget.emit('change');

    expect(handlers.onOnline).toHaveBeenCalledTimes(1);
    expect(handlers.onOffline).toHaveBeenCalledTimes(1);
    expect(handlers.onChange).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe снимает все зарегистрированные обработчики', () => {
    const windowTarget = createEventEmitterTarget();
    const connectionTarget = createEventEmitterTarget();
    const handlers: TNetworkEventsHandlers = {
      onOnline: jest.fn(),
      onOffline: jest.fn(),
      onChange: jest.fn(),
    };

    const subscriber = createBrowserNetworkEventsSubscriber({
      windowRef: windowTarget.target as unknown as Window,
      navigatorRef: {
        connection: connectionTarget.target as unknown as EventTarget,
      } as Navigator & { connection?: EventTarget },
    });

    subscriber?.subscribe(handlers);
    subscriber?.unsubscribe();

    windowTarget.emit('online');
    windowTarget.emit('offline');
    connectionTarget.emit('change');

    expect(handlers.onOnline).not.toHaveBeenCalled();
    expect(handlers.onOffline).not.toHaveBeenCalled();
    expect(handlers.onChange).not.toHaveBeenCalled();
  });

  it('работает без navigatorRef и не падает без connection listeners', () => {
    const windowTarget = createEventEmitterTarget();
    const handlers: TNetworkEventsHandlers = {
      onOnline: jest.fn(),
      onOffline: jest.fn(),
      onChange: jest.fn(),
    };

    const subscriber = createBrowserNetworkEventsSubscriber({
      windowRef: windowTarget.target as unknown as Window,
      navigatorRef: undefined,
    });

    subscriber?.subscribe(handlers);
    windowTarget.emit('online');
    windowTarget.emit('offline');

    expect(handlers.onOnline).toHaveBeenCalledTimes(1);
    expect(handlers.onOffline).toHaveBeenCalledTimes(1);
    expect(handlers.onChange).not.toHaveBeenCalled();
  });
});
