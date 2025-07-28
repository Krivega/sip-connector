import type { UA, WebSocketInterface } from '@krivega/jssip';
import type { Originator } from './CallManager';

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

export type TCustomError = Error & {
  originator?: Originator;
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

export type TContentHint = 'motion' | 'detail' | 'text' | 'none';

export type TRtpSendParameters = Partial<Omit<RTCRtpSendParameters, 'transactionId'>>;
export type TSize = { width: number; height: number };

export type TSimulcastEncoding = TSize & {
  rid?: string;
  scalabilityMode?: string;
};
