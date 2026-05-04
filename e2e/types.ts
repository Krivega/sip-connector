export type TSipConnectorDemoE2EHooks = {
  blockServerAddressApi: (serverAddress: string) => void;
  simulateNetworkInterfaceChange: () => void;
  forcePingProbeResult: (result: 'ok' | 'fail' | 'real') => void;
  forceGetUserMediaResult: (result: 'real' | 'fail') => void;
  forceGetDisplayMediaResult: (result: 'real' | 'fail') => void;
};

export type TSipConnectorDemoE2EWebSocketHooks = {
  blockWsMessages: (serverAddress: string) => void;
  blockWsResponseMessages: (serverAddress: string) => void;
  disconnectWsTransport: (serverAddress: string) => void;
  blockCreateNewWsTransport: (serverAddress: string) => void;
  getSentWsOptionsCount: (serverAddress: string) => number;
};

export type TSipConnectorDemoE2EWindow = Window & {
  sipConnectorDemoE2E?: TSipConnectorDemoE2EHooks;
  sipConnectorDemoE2EWebSocket?: TSipConnectorDemoE2EWebSocketHooks;
};
