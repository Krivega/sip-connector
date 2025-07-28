import type { UA, WebSocketInterface } from '@krivega/jssip';
import type { Originator } from './CallManager';

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
