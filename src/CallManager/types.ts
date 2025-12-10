import type { RTCSession, UA } from '@krivega/jssip';
import type { TContentHint } from '@/PresentationManager';
import type { Originator } from './eventNames';

export type TOntrack = (event: RTCTrackEvent) => void;

export type TOnAddedTransceiver = (
  transceiver: RTCRtpTransceiver,
  track: MediaStreamTrack,
  streams: MediaStream[],
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
  degradationPreference?: RTCDegradationPreference;
  sendEncodings?: RTCRtpEncodingParameters[];
  offerToReceiveAudio?: boolean;
  offerToReceiveVideo?: boolean;
  onAddedTransceiver?: TOnAddedTransceiver;
};

export type TParamsCall = TParamsAnswerToIncomingCall & {
  number: string;
};

export type TCustomError = Error & {
  originator?: `${Originator}`;
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
  readonly isCallActive: boolean;
  getEstablishedRTCSession: () => RTCSession | undefined;
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
  getCallConfiguration: () => TCallConfiguration;
  getRemoteStreams: () => MediaStream[] | undefined;
  addTransceiver: (
    kind: 'audio' | 'video',
    options?: RTCRtpTransceiverInit,
  ) => Promise<RTCRtpTransceiver>;
  replaceMediaStream: (
    mediaStream: MediaStream,
    options?: {
      deleteExisting?: boolean;
      addMissing?: boolean;
      forceRenegotiation?: boolean;
      contentHint?: TContentHint;
      degradationPreference?: RTCDegradationPreference;
      sendEncodings?: RTCRtpEncodingParameters[];
      onAddedTransceiver?: TOnAddedTransceiver;
    },
  ) => Promise<void>;
  restartIce: (options?: {
    extraHeaders?: string[];
    useUpdate?: boolean;
    rtcOfferConstraints?: RTCOfferOptions;
    sendEncodings?: RTCRtpEncodingParameters[];
    degradationPreference?: RTCDegradationPreference;
  }) => Promise<boolean>;
}

export interface IMCUSession {
  // Свойства (getters)
  readonly connection: RTCPeerConnection | undefined;
  readonly isCallActive: boolean;
  getEstablishedRTCSession: () => RTCSession | undefined;
  // Методы
  startCall: ICallStrategy['startCall'];
  endCall: () => Promise<void>;
  answerToIncomingCall: (
    incomingRTCSession: RTCSession,
    params: TParamsAnswerToIncomingCall,
  ) => Promise<RTCPeerConnection>;
  getRemoteTracks: () => MediaStreamTrack[] | undefined;
  replaceMediaStream: ICallStrategy['replaceMediaStream'];
  restartIce: (options?: {
    useUpdate?: boolean;
    extraHeaders?: string[];
    rtcOfferConstraints?: RTCOfferOptions;
    sendEncodings?: RTCRtpEncodingParameters[];
    degradationPreference?: RTCDegradationPreference;
  }) => Promise<boolean>;
  addTransceiver: (
    kind: 'audio' | 'video',
    options?: RTCRtpTransceiverInit,
  ) => Promise<RTCRtpTransceiver>;
}
