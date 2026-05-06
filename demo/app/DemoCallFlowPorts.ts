import type { TRemoteStreams } from '@/index';

/**
 * Минимальный контракт сессии для сценариев демо (реальный `Session` совместим структурно; в тестах — простой мок).
 */
export type TDemoCallFlowSession = {
  hasConnected: () => boolean;
  connect: (params: {
    serverUrl: string;
    isRegistered: boolean;
    displayName: string;
    user: string;
    password: string;
  }) => Promise<void>;
  callToServer: (params: {
    conference: string;
    mediaStream: MediaStream;
    autoRedial?: boolean;
    setRemoteStreams: (streams: TRemoteStreams) => void;
  }) => Promise<void>;
  disconnectFromServer: () => Promise<void>;
  hangUpCall: () => Promise<void>;
  stopCall: () => Promise<void>;
  sendMediaState: (state: { isEnabledCam: boolean; isEnabledMic: boolean }) => Promise<unknown>;
};

/**
 * Порт UI-лоадера: сценарии звонка не зависят от конкретного LoaderManager.
 */
export type TDemoCallFlowLoaderPort = {
  show: (message?: string) => void;
  hide: () => void;
  setMessage: (message: string) => void;
};

/**
 * Порт фабрики SIP-сессии: в тестах подменяется заглушкой без сети.
 */
export type TDemoSessionFactoryPort = {
  createSession: () => TDemoCallFlowSession;
};

/**
 * Порт локального медиа для исходящего звонка (getUserMedia и т.д.).
 */
export type TDemoCallMediaPort = {
  initialize: () => Promise<MediaStream>;
  getStream: () => MediaStream | undefined;
};

export type TDemoCallFlowPorts = {
  loader: TDemoCallFlowLoaderPort;
  sessionFactory: TDemoSessionFactoryPort;
  media: TDemoCallMediaPort;
};
