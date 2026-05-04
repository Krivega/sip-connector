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
  let forcedPingProbeResult: 'ok' | 'fail' | 'real' = 'real';
  let forcedGetUserMediaResult: 'real' | 'fail' = 'real';
  let forcedGetDisplayMediaResult: 'real' | 'fail' = 'real';
  let originalConnectionPing:
    | ((body?: string, extraHeaders?: string[]) => Promise<void>)
    | undefined;
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

  const demoWindow = window as Window & { sipConnectorDemoE2E?: unknown };

  demoWindow.sipConnectorDemoE2E = {
    blockServerAddressApi: (serverAddress: string) => {
      const normalizedServerHostname = normalizeServerHostname(serverAddress);

      blockedApiHostnames.add(normalizedServerHostname);
    },
    simulateNetworkInterfaceChange: () => {
      syncConnectionManagerPingOverride();
      navigatorWithConnection.connection?.dispatchEvent(new Event('change'));
    },
    forcePingProbeResult: (result: 'ok' | 'fail' | 'real') => {
      forcedPingProbeResult = result;
      syncConnectionManagerPingOverride();
    },
    forceGetUserMediaResult: (result: 'real' | 'fail') => {
      forcedGetUserMediaResult = result;
    },
    forceGetDisplayMediaResult: (result: 'real' | 'fail') => {
      forcedGetDisplayMediaResult = result;
    },
  };
};
