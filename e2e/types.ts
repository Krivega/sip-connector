export type TSipConnectorDemoE2EHooks = {
  blockServerAddressApi: (serverAddress: string) => void;
  blockWsMessages: (serverAddress: string) => void;
  disconnectWsTransport: (serverAddress: string) => void;
  simulateNetworkInterfaceChange: () => void;
  forcePingProbeResult: (result: 'ok' | 'fail' | 'real') => void;
  forceGetUserMediaResult: (result: 'real' | 'fail') => void;
  forceGetDisplayMediaResult: (result: 'real' | 'fail') => void;
};

export type TSipConnectorDemoE2EWindow = Window & {
  sipConnectorDemoE2E?: TSipConnectorDemoE2EHooks;
};
