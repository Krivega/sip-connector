import type { INetworkEventsSubscriber, TNetworkEventsHandlers } from './types';

type TBrowserConnection = EventTarget | undefined;

type TBrowserLikeNavigator = Navigator & {
  connection?: TBrowserConnection;
};

type TCreateBrowserNetworkEventsSubscriberOptions = {
  windowRef?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  navigatorRef?: TBrowserLikeNavigator;
};

const resolveBrowserWindow = (options?: TCreateBrowserNetworkEventsSubscriberOptions) => {
  if (options && Object.hasOwn(options, 'windowRef')) {
    return options.windowRef;
  }

  if (typeof window === 'undefined') {
    return undefined;
  }

  return window;
};

const resolveBrowserNavigator = (options?: TCreateBrowserNetworkEventsSubscriberOptions) => {
  if (options && Object.hasOwn(options, 'navigatorRef')) {
    return options.navigatorRef;
  }

  if (typeof navigator === 'undefined') {
    return undefined;
  }

  return navigator as TBrowserLikeNavigator;
};

export const createBrowserNetworkEventsSubscriber = (
  options?: TCreateBrowserNetworkEventsSubscriberOptions,
): INetworkEventsSubscriber | undefined => {
  const browserWindow = resolveBrowserWindow(options);
  const browserNavigator = resolveBrowserNavigator(options);

  if (!browserWindow) {
    return undefined;
  }

  let disposers: (() => void)[] = [];

  const unsubscribe = () => {
    disposers.forEach((dispose) => {
      dispose();
    });
    disposers = [];
  };

  return {
    subscribe: (handlers: TNetworkEventsHandlers) => {
      // Defensive: повторная subscribe без unsubscribe не должна оставлять хвосты.
      unsubscribe();

      const online = () => {
        handlers.onOnline();
      };
      const offline = () => {
        handlers.onOffline();
      };
      const change = () => {
        handlers.onChange();
      };

      browserWindow.addEventListener('online', online);
      browserWindow.addEventListener('offline', offline);

      const connection = browserNavigator?.connection;

      connection?.addEventListener('change', change);

      disposers = [
        () => {
          browserWindow.removeEventListener('online', online);
        },
        () => {
          browserWindow.removeEventListener('offline', offline);
        },
        () => {
          connection?.removeEventListener('change', change);
        },
      ];
    },
    unsubscribe,
  };
};
