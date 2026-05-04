import type { TSipConnectorDemoE2EWindow } from '../types';

export const installE2ENetworkControls = () => {
  const navigatorWithConnection = navigator as Navigator & { connection?: EventTarget };

  // Обеспечиваем наличие navigator.connection для стабильной e2e-симуляции network-change.
  if (navigatorWithConnection.connection === undefined) {
    Object.defineProperty(navigatorWithConnection, 'connection', {
      value: new EventTarget(),
      configurable: true,
      enumerable: true,
      writable: false,
    });
  }

  const blockedApiHostnames = new Set<string>();
  const blockedWsMessageHostnames = new Set<string>();
  const blockedWsResponseHostnames = new Set<string>();
  const blockedWsTransportHostnames = new Set<string>();
  const sentWsOptionsCountByHostname = new Map<string, number>();
  let forcedPingProbeResult: 'ok' | 'fail' | 'real' = 'real';
  let forcedGetUserMediaResult: 'real' | 'fail' = 'real';
  let forcedGetDisplayMediaResult: 'real' | 'fail' = 'real';
  let originalConnectionPing:
    | ((body?: string, extraHeaders?: string[]) => Promise<void>)
    | undefined;
  const openedSockets: { socket: WebSocket; hostname: string }[] = [];
  const syncConnectionManagerPingOverride = () => {
    const windowWithDemoApp = window as Window;
    const demoApp = Reflect.get(windowWithDemoApp, '__sipConnectorDemoApp') as
      | {
          sipConnectorFacade?: {
            sipConnector?: {
              connectionManager?: {
                ping: (body?: string, extraHeaders?: string[]) => Promise<void>;
              };
            };
          };
        }
      | undefined;
    const connectionManager = demoApp?.sipConnectorFacade?.sipConnector?.connectionManager;

    if (!connectionManager) {
      return;
    }

    originalConnectionPing ??= connectionManager.ping.bind(connectionManager);

    if (forcedPingProbeResult === 'real') {
      connectionManager.ping = originalConnectionPing;

      return;
    }

    connectionManager.ping = async () => {
      if (forcedPingProbeResult === 'ok') {
        return;
      }

      throw new Error('Forced ping failure by e2e control');
    };
  };

  const originalFetch = window.fetch.bind(window);
  const OriginalWebSocket = window.WebSocket;
  const { mediaDevices } = navigator;
  const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
  const originalGetDisplayMedia = mediaDevices.getDisplayMedia.bind(mediaDevices);

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

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (isBlockedApiRequest(normalizeRequestUrl(input))) {
      throw new TypeError('Failed to fetch');
    }

    return originalFetch(input, init);
  };

  mediaDevices.getUserMedia = async (
    constraints?: MediaStreamConstraints,
  ): Promise<MediaStream> => {
    if (forcedGetUserMediaResult === 'fail') {
      throw new Error('Forced getUserMedia failure by e2e control');
    }

    return originalGetUserMedia(constraints);
  };

  mediaDevices.getDisplayMedia = async (
    constraints?: DisplayMediaStreamOptions,
  ): Promise<MediaStream> => {
    if (forcedGetDisplayMediaResult === 'fail') {
      throw new Error('Forced getDisplayMedia failure by e2e control');
    }

    return originalGetDisplayMedia(constraints);
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

  (window as TSipConnectorDemoE2EWindow).sipConnectorDemoE2E = {
    blockServerAddressApi: (serverAddress: string) => {
      const normalizedServerHostname = normalizeServerHostname(serverAddress);

      blockedApiHostnames.add(normalizedServerHostname);
    },
    blockWsMessages: (serverAddress: string) => {
      const normalizedServerHostname = normalizeServerHostname(serverAddress);

      blockedWsMessageHostnames.add(normalizedServerHostname);
    },
    blockWsResponseMessages: (serverAddress: string) => {
      const normalizedServerHostname = normalizeServerHostname(serverAddress);

      blockedWsResponseHostnames.add(normalizedServerHostname);
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
      const normalizedServerHostname = normalizeServerHostname(serverAddress);

      blockedWsTransportHostnames.add(normalizedServerHostname);
    },
    simulateNetworkInterfaceChange: () => {
      syncConnectionManagerPingOverride();
      navigatorWithConnection.connection?.dispatchEvent(new Event('change'));
    },
    forcePingProbeResult: (result: 'ok' | 'fail' | 'real') => {
      forcedPingProbeResult = result;
      syncConnectionManagerPingOverride();
    },
    getSentWsOptionsCount: (serverAddress: string) => {
      const normalizedServerHostname = normalizeServerHostname(serverAddress);

      return sentWsOptionsCountByHostname.get(normalizedServerHostname) ?? 0;
    },
    forceGetUserMediaResult: (result: 'real' | 'fail') => {
      forcedGetUserMediaResult = result;
    },
    forceGetDisplayMediaResult: (result: 'real' | 'fail') => {
      forcedGetDisplayMediaResult = result;
    },
  };
};
