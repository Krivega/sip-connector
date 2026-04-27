import type { TSipConnectorDemoE2EWindow } from '../types';

export const installE2ENetworkControls = () => {
  const blockedApiHostnames = new Set<string>();
  const blockedWsMessageHostnames = new Set<string>();
  const blockedWsTransportHostnames = new Set<string>();
  const openedSockets: { socket: WebSocket; hostname: string }[] = [];
  const originalFetch = window.fetch.bind(window);
  const OriginalWebSocket = window.WebSocket;

  const normalizeServerHostname = (serverAddress: string): string => {
    return new URL(`https://${serverAddress.trim()}`).hostname;
  };

  const isBlockedApiRequest = (urlValue: string): boolean => {
    try {
      const url = new URL(urlValue, window.location.href);

      return (
        url.protocol === 'https:' &&
        url.pathname === '/api/v1/address' &&
        blockedApiHostnames.has(url.hostname)
      );
    } catch {
      return false;
    }
  };

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

  const normalizeRequestUrl = (input: RequestInfo | URL): string => {
    if (typeof input === 'string') {
      return input;
    }

    if (input instanceof URL) {
      return input.toString();
    }

    return input.url;
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (isBlockedApiRequest(normalizeRequestUrl(input))) {
      throw new TypeError('Failed to fetch');
    }

    return originalFetch(input, init);
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
        if (blockedWsMessageHostnames.has(socketHostname)) {
          return;
        }

        originalSend(data);
      }) as typeof socket.send;

      socket.addEventListener(
        'message',
        (event) => {
          if (blockedWsMessageHostnames.has(socketHostname)) {
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

  (window as TSipConnectorDemoE2EWindow).sipConnectorDemoE2E = {
    blockServerAddressApi: (serverAddress: string) => {
      const normalizedServerHostname = normalizeServerHostname(serverAddress);

      blockedApiHostnames.add(normalizedServerHostname);
    },
    blockWsMessages: (serverAddress: string) => {
      const normalizedServerHostname = normalizeServerHostname(serverAddress);

      blockedWsMessageHostnames.add(normalizedServerHostname);
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
    simulateNetworkInterfaceChange: () => {
      (navigator as Navigator & { connection?: EventTarget }).connection?.dispatchEvent(
        new Event('change'),
      );
    },
  };
};
