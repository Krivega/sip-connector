import type { UA, WebSocketInterface } from '@krivega/jssip';

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
