import type { UA, WebSocketInterface } from '@krivega/jssip';

export type TJsSIP = {
  UA: typeof UA;
  WebSocketInterface: typeof WebSocketInterface;
};

export type TGetServerUrl = (id: string) => string;

export type TRtpSendParameters = Partial<Omit<RTCRtpSendParameters, 'transactionId'>>;
export type TSize = { width: number; height: number };

export type TSimulcastEncoding = TSize & {
  rid?: string;
  scalabilityMode?: string;
};

// do not remove this enum, it is used in exports
export enum EMimeTypesVideoCodecs {
  VP8 = 'video/VP8',
  VP9 = 'video/VP9',
  H264 = 'video/H264',
  AV1 = 'video/AV1',
  rtx = 'video/rtx',
  red = 'video/red',
  flexfec03 = 'video/flexfec-03',
}
