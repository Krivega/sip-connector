import type { UA, WebSocketInterface } from '@krivega/jssip';

export enum EEventsMainCAM {
  PAUSE_MAIN_CAM = 'PAUSEMAINCAM',
  RESUME_MAIN_CAM = 'RESUMEMAINCAM',
  MAX_MAIN_CAM_RESOLUTION = 'MAXMAINCAMRESOLUTION',
  ADMIN_STOP_MAIN_CAM = 'ADMINSTOPMAINCAM',
  ADMIN_START_MAIN_CAM = 'ADMINSTARTMAINCAM',
}

export enum EEventsMic {
  ADMIN_STOP_MIC = 'ADMINSTOPMIC',
  ADMIN_START_MIC = 'ADMINSTARTMIC',
}

export enum EEventsSyncMediaState {
  ADMIN_SYNC_FORCED = '1',
  ADMIN_SYNC_NOT_FORCED = '0',
}

export enum EUseLicense {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  AUDIOPLUSPRESENTATION = 'AUDIOPLUSPRESENTATION',
}

export type TCustomError = Error & {
  originator?: string;
  cause?: unknown;
  message: unknown;
  _ws?: unknown;
  socket?: unknown;
  url?: string;
  code?: string;
};

export type TJsSIP = {
  UA: typeof UA;
  WebSocketInterface: typeof WebSocketInterface;
};

export type TGetServerUrl = (id: string) => string;

export type TParametersCreateUaConfiguration = {
  sipWebSocketServerURL: string;
  displayName?: string;
  sipServerUrl: string;
  user?: string;
  register?: boolean;
  password?: string;
  sessionTimers?: boolean;
  registerExpires?: number;
  connectionRecoveryMinInterval?: number;
  connectionRecoveryMaxInterval?: number;
  userAgent?: string;
};

export type TOnAddedTransceiver = (
  transceiver: RTCRtpTransceiver,
  track: MediaStreamTrack,
  stream: MediaStream,
) => Promise<void>;
export type TContentHint = 'motion' | 'detail' | 'text' | 'none';

export type TRtpSendParameters = Partial<Omit<RTCRtpSendParameters, 'transactionId'>>;
export type TSize = { width: number; height: number };
export type TSimulcastEncodings = TSize[];

export enum EMimeTypesVideoCodecs {
  VP8 = 'video/VP8',
  VP9 = 'video/VP9',
  H264 = 'video/H264',
  AV1 = 'video/AV1',
  rtx = 'video/rtx',
  red = 'video/red',
  flexfec03 = 'video/flexfec-03',
}
