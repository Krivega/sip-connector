import type { TContentHint } from '@/PresentationManager';
import type { RTCSession, UA } from '@krivega/jssip';
import type { Originator } from './eventNames';

export type TOntrack = (track: RTCTrackEvent) => void;

export type TOnAddedTransceiver = (
  transceiver: RTCRtpTransceiver,
  track: MediaStreamTrack,
  stream: MediaStream,
) => Promise<void>;
export type TGetServerUrl = (id: string) => string;

type TOptionsExtraHeaders = {
  extraHeaders?: string[];
};

type TParamsAnswerToIncomingCall = {
  mediaStream: MediaStream;
  extraHeaders?: TOptionsExtraHeaders['extraHeaders'];
  ontrack?: TOntrack;
  iceServers?: RTCIceServer[];
  directionVideo?: RTCRtpTransceiverDirection;
  directionAudio?: RTCRtpTransceiverDirection;
  contentHint?: TContentHint;
  sendEncodings?: RTCRtpEncodingParameters[];
  offerToReceiveAudio?: boolean;
  offerToReceiveVideo?: boolean;
  onAddedTransceiver?: TOnAddedTransceiver;
};

export type TParamsCall = TParamsAnswerToIncomingCall & {
  number: string;
};

export type TCustomError = Error & {
  originator?: Originator;
  cause?: unknown;
  message: unknown;
  _ws?: unknown;
  socket?: unknown;
  url?: string;
  code?: string;
};

export type TCallConfiguration = {
  answer?: boolean;
  number?: string;
};

export interface ICallStrategy {
  // Свойства (getters)
  readonly requested: boolean;
  readonly connection: RTCPeerConnection | undefined;
  readonly establishedRTCSession: RTCSession | undefined;
  readonly isCallActive: boolean;
  // Методы
  startCall: (
    ua: UA,
    getSipServerUrl: TGetServerUrl,
    params: TParamsCall,
  ) => Promise<RTCPeerConnection>;
  endCall: () => Promise<void>;
  answerToIncomingCall: (
    extractIncomingRTCSession: () => RTCSession,
    params: TParamsAnswerToIncomingCall,
  ) => Promise<RTCPeerConnection>;
  getEstablishedRTCSession: () => RTCSession | undefined;
  getCallConfiguration: () => TCallConfiguration;
  getRemoteStreams: () => MediaStream[] | undefined;
  replaceMediaStream: (
    mediaStream: MediaStream,
    options?: {
      deleteExisting?: boolean;
      addMissing?: boolean;
      forceRenegotiation?: boolean;
      contentHint?: TContentHint;
      sendEncodings?: RTCRtpEncodingParameters[];
      onAddedTransceiver?: TOnAddedTransceiver;
    },
  ) => Promise<void>;
}
