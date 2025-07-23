import type { RTCSession, UA } from '@krivega/jssip';
import type Events from 'events-constructor';
import type { EVENT_NAMES, Originator } from './eventNames';

export type TOntrack = (track: RTCTrackEvent) => void;

export type TOnAddedTransceiver = (
  transceiver: RTCRtpTransceiver,
  track: MediaStreamTrack,
  stream: MediaStream,
) => Promise<void>;
export type TContentHint = 'motion' | 'detail' | 'text' | 'none';
export type TGetServerUrl = (id: string) => string;

type TOptionsExtraHeaders = {
  extraHeaders?: string[];
};

type TParametersAnswerToIncomingCall = {
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

export type TParametersCall = TParametersAnswerToIncomingCall & {
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

export interface ICallStrategy {
  startCall: (
    parameters: TParametersCall,
    ua: UA,
    getSipServerUrl: TGetServerUrl,
  ) => Promise<RTCPeerConnection>;
  endCall: () => Promise<void>;
  answerIncomingCall: (localStream: MediaStream) => Promise<void>;
  getEstablishedRTCSession: () => RTCSession | undefined;
}

export type TEvents = Events<typeof EVENT_NAMES>;
