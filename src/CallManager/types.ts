import type { RTCSession, UA } from '@krivega/jssip';
import type { TContentHint } from '@/PresentationManager';
import type { Originator } from './eventNames';
import type { TTools } from './RecvSession';

export type TOnAddedTransceiver = (
  transceiver: RTCRtpTransceiver,
  track: MediaStreamTrack,
  streams: MediaStream[],
) => Promise<void>;
export type TGetUri = (id: string) => string;

type TOptionsExtraHeaders = {
  extraHeaders?: string[];
};

type TParamsAnswerToIncomingCall = {
  mediaStream: MediaStream;
  extraHeaders?: TOptionsExtraHeaders['extraHeaders'];
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

export type TCallRoleParticipant = { type: 'participant' };
export type TCallRoleSpectatorSynthetic = { type: 'spectator_synthetic' };
export type TCallRoleSpectator = {
  type: 'spectator';
  recvParams: { audioId: string; sendOffer: TTools['sendOffer'] };
};
export type TCallRole = TCallRoleParticipant | TCallRoleSpectatorSynthetic | TCallRoleSpectator;

export type TStartCall = (
  ua: UA,
  getUri: TGetUri,
  params: TParamsCall,
) => Promise<RTCPeerConnection>;
export type TReplaceMediaStream = (
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

export type TAnswerToIncomingCall = (
  extractIncomingRTCSession: () => RTCSession,
  params: TParamsAnswerToIncomingCall,
) => Promise<RTCPeerConnection>;

export interface IMCUSession {
  // Свойства (getters)
  readonly connection: RTCPeerConnection | undefined;
  readonly isCallActive: boolean;
  getEstablishedRTCSession: () => RTCSession | undefined;
  // Методы
  startCall: TStartCall;
  endCall: () => Promise<void>;
  answerToIncomingCall: (
    incomingRTCSession: RTCSession,
    params: TParamsAnswerToIncomingCall,
  ) => Promise<RTCPeerConnection>;
  replaceMediaStream: TReplaceMediaStream;
  restartIce: (options?: {
    useUpdate?: boolean;
    extraHeaders?: string[];
    rtcOfferConstraints?: RTCOfferOptions;
    sendEncodings?: RTCRtpEncodingParameters[];
    degradationPreference?: RTCDegradationPreference;
  }) => Promise<boolean>;
}
