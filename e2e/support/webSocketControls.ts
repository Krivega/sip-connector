import type { TSipConnectorDemoE2EWebSocketHooks } from '../types';

/** Ключ `window`, куда кладётся объект e2e-управления WebSocket. */
export const SIP_CONNECTOR_DEMO_E2E_WEBSOCKET_GLOBAL_KEY = 'sipConnectorDemoE2EWebSocket' as const;

/** Регистрирует перехват WebSocket и выставляет `window.sipConnectorDemoE2EWebSocket` (SIP_CONNECTOR_DEMO_E2E_WEBSOCKET_GLOBAL_KEY). */
export const installE2EWebSocketControls = () => {
  // Контрактный ключ: должен совпадать с SIP_CONNECTOR_DEMO_E2E_WEBSOCKET_GLOBAL_KEY в ConnectPage.
  // Не менять без синхронного обновления page-object и e2e-хуков.
  // Нельзя использовать SIP_CONNECTOR_DEMO_E2E_WEBSOCKET_GLOBAL_KEY напрямую:
  // context.addInitScript сериализует только тело этой функции, внешние константы не попадают в browser context.
  const globalKey = 'sipConnectorDemoE2EWebSocket';
  const normalizeServerHostname = (serverAddress: string): string => {
    return new URL(`https://${serverAddress.trim()}`).hostname;
  };

  // addInitScript сериализует только это тело функции,
  // поэтому фабрика должна быть объявлена локально без внешних зависимостей.
  const createWebSocketControlsInInitScript = (): TSipConnectorDemoE2EWebSocketHooks => {
    const blockedWsMessageHostnames = new Set<string>();
    const blockedWsResponseHostnames = new Set<string>();
    const blockedWsTransportHostnames = new Set<string>();
    const sentWsOptionsCountByHostname = new Map<string, number>();
    const openedSockets: { socket: WebSocket; hostname: string }[] = [];
    const OriginalWebSocket = window.WebSocket;

    const resolveSocketHostname = (urlValue: string): string | undefined => {
      try {
        const url = new URL(urlValue, window.location.href);

        if (url.protocol !== 'wss:') {
          return undefined;
        }

        return url.hostname;
      } catch {
        return undefined;
      }
    };

    const isSipOptionsMessage = (
      data: string | ArrayBufferLike | Blob | ArrayBufferView,
    ): boolean => {
      return typeof data === 'string' && data.startsWith('OPTIONS ');
    };

    const incrementSentWsOptionsCount = (hostname: string) => {
      sentWsOptionsCountByHostname.set(
        hostname,
        (sentWsOptionsCountByHostname.get(hostname) ?? 0) + 1,
      );
    };

    const WrappedWebSocket = function wrappedWebSocket(
      this: WebSocket,
      url: string | URL,
      protocols?: string | string[],
    ): WebSocket {
      const normalizedUrl = typeof url === 'string' ? url : url.toString();
      const socketHostname = resolveSocketHostname(normalizedUrl);

      if (socketHostname !== undefined && blockedWsTransportHostnames.has(socketHostname)) {
        throw new Error('WebSocket connection blocked by e2e network control');
      }

      const socket =
        protocols === undefined
          ? new OriginalWebSocket(normalizedUrl)
          : new OriginalWebSocket(normalizedUrl, protocols);

      if (socketHostname !== undefined) {
        const originalSend = socket.send.bind(socket);

        socket.send = ((data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
          if (isSipOptionsMessage(data)) {
            incrementSentWsOptionsCount(socketHostname);
          }

          if (blockedWsMessageHostnames.has(socketHostname)) {
            return;
          }

          originalSend(data);
        }) as typeof socket.send;

        socket.addEventListener(
          'message',
          (event) => {
            if (
              blockedWsMessageHostnames.has(socketHostname) ||
              blockedWsResponseHostnames.has(socketHostname)
            ) {
              event.stopImmediatePropagation();
            }
          },
          { capture: true },
        );

        openedSockets.push({ socket, hostname: socketHostname });
      }

      socket.addEventListener('close', () => {
        const index = openedSockets.findIndex((entry) => {
          return entry.socket === socket;
        });

        if (index >= 0) {
          openedSockets.splice(index, 1);
        }
      });

      return socket;
    } as unknown as typeof WebSocket;

    WrappedWebSocket.prototype = OriginalWebSocket.prototype;
    Object.assign(WrappedWebSocket, OriginalWebSocket);
    window.WebSocket = WrappedWebSocket;

    return {
      blockWsMessages: (serverAddress: string) => {
        blockedWsMessageHostnames.add(normalizeServerHostname(serverAddress));
      },
      blockWsResponseMessages: (serverAddress: string) => {
        blockedWsResponseHostnames.add(normalizeServerHostname(serverAddress));
      },
      disconnectWsTransport: (serverAddress: string) => {
        const normalizedServerHostname = normalizeServerHostname(serverAddress);

        blockedWsTransportHostnames.add(normalizedServerHostname);

        openedSockets.forEach(({ socket, hostname }) => {
          try {
            if (hostname === normalizedServerHostname) {
              socket.close(1011, 'e2e: network interface switched');
            }
          } catch {
            /* ignore */
          }
        });
      },
      blockCreateNewWsTransport: (serverAddress: string) => {
        blockedWsTransportHostnames.add(normalizeServerHostname(serverAddress));
      },
      getSentWsOptionsCount: (serverAddress: string) => {
        return sentWsOptionsCountByHostname.get(normalizeServerHostname(serverAddress)) ?? 0;
      },
    };
  };

  const hooks = createWebSocketControlsInInitScript();

  Reflect.set(window, globalKey, hooks);
};
