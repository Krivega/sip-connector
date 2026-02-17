/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import { TypedEvents } from 'events-constructor';

import type { IncomingInfoEvent, OutgoingInfoEvent, EndEvent } from '@krivega/jssip';
import type { TEffectiveQuality, TRecvQuality } from './quality';
import type { TRemoteStreams, TRemoteTracksChangeType } from './types';

export enum EEvent {
  // rtcSession events
  PEER_CONNECTION = 'peerconnection',
  CONNECTING = 'connecting',
  SENDING = 'sending',
  PROGRESS = 'progress',
  ACCEPTED = 'accepted',
  CONFIRMED = 'confirmed',
  ENDED = 'ended',
  FAILED = 'failed',
  NEW_DTMF = 'newDTMF',
  NEW_INFO = 'newInfo',
  HOLD = 'hold',
  UNHOLD = 'unhold',
  MUTED = 'muted',
  UNMUTED = 'unmuted',
  REINVITE = 'reinvite',
  UPDATE = 'update',
  REFER = 'refer',
  REPLACES = 'replaces',
  SDP = 'sdp',
  ICE_CANDIDATE = 'icecandidate',
  GET_USER_MEDIA_FAILED = 'getusermediafailed',
  PEER_CONNECTION_CREATE_OFFER_FAILED = 'peerconnection:createofferfailed',
  PEER_CONNECTION_CREATE_ANSWER_FAILED = 'peerconnection:createanswerfailed',
  PEER_CONNECTION_SET_LOCAL_DESCRIPTION_FAILED = 'peerconnection:setlocaldescriptionfailed',
  PEER_CONNECTION_SET_REMOTE_DESCRIPTION_FAILED = 'peerconnection:setremotedescriptionfailed',
  // presentation events
  START_PRESENTATION = 'presentation:start',
  STARTED_PRESENTATION = 'presentation:started',
  END_PRESENTATION = 'presentation:end',
  ENDED_PRESENTATION = 'presentation:ended',
  FAILED_PRESENTATION = 'presentation:failed',

  // synthetic events
  START_CALL = 'start-call',
  PEER_CONNECTION_CONFIRMED = 'peerconnection:confirmed',
  PEER_CONNECTION_ONTRACK = 'peerconnection:ontrack',
  ENDED_FROM_SERVER = 'ended:fromserver',
  CALL_STATUS_CHANGED = 'call-status-changed',
  REMOTE_TRACKS_CHANGED = 'remote-tracks-changed',
  REMOTE_STREAMS_CHANGED = 'remote-streams-changed',
  RECV_SESSION_STARTED = 'recv-session-started',
  RECV_SESSION_ENDED = 'recv-session-ended',
  RECV_QUALITY_CHANGED = 'recv-quality-changed',
}

export enum Originator {
  LOCAL = 'local',
  REMOTE = 'remote',
  SYSTEM = 'system',
}

export const SESSION_JSSIP_EVENT_NAMES = [
  `${EEvent.PEER_CONNECTION}`,
  `${EEvent.CONNECTING}`,
  `${EEvent.SENDING}`,
  `${EEvent.PROGRESS}`,
  `${EEvent.ACCEPTED}`,
  `${EEvent.CONFIRMED}`,
  `${EEvent.ENDED}`,
  `${EEvent.FAILED}`,
  `${EEvent.HOLD}`,
  `${EEvent.UNHOLD}`,
  `${EEvent.MUTED}`,
  `${EEvent.UNMUTED}`,
  `${EEvent.NEW_INFO}`,
  `${EEvent.NEW_DTMF}`,
  `${EEvent.START_PRESENTATION}`,
  `${EEvent.STARTED_PRESENTATION}`,
  `${EEvent.END_PRESENTATION}`,
  `${EEvent.ENDED_PRESENTATION}`,
  `${EEvent.FAILED_PRESENTATION}`,
  `${EEvent.REINVITE}`,
  `${EEvent.UPDATE}`,
  `${EEvent.REFER}`,
  `${EEvent.REPLACES}`,
  `${EEvent.SDP}`,
  `${EEvent.ICE_CANDIDATE}`,
  `${EEvent.GET_USER_MEDIA_FAILED}`,
  `${EEvent.PEER_CONNECTION_CREATE_OFFER_FAILED}`,
  `${EEvent.PEER_CONNECTION_CREATE_ANSWER_FAILED}`,
  `${EEvent.PEER_CONNECTION_SET_LOCAL_DESCRIPTION_FAILED}`,
  `${EEvent.PEER_CONNECTION_SET_REMOTE_DESCRIPTION_FAILED}`,
] as const;

const SESSION_SYNTHETICS_EVENT_NAMES = [
  `${EEvent.START_CALL}`,
  `${EEvent.PEER_CONNECTION_CONFIRMED}`,
  `${EEvent.PEER_CONNECTION_ONTRACK}`,
  `${EEvent.ENDED_FROM_SERVER}`,
  `${EEvent.CALL_STATUS_CHANGED}`,
  `${EEvent.REMOTE_TRACKS_CHANGED}`,
  `${EEvent.REMOTE_STREAMS_CHANGED}`,
  `${EEvent.RECV_SESSION_STARTED}`,
  `${EEvent.RECV_SESSION_ENDED}`,
  `${EEvent.RECV_QUALITY_CHANGED}`,
] as const;

export const EVENT_NAMES = [
  ...SESSION_JSSIP_EVENT_NAMES,
  ...SESSION_SYNTHETICS_EVENT_NAMES,
] as const;

export type TEventName = (typeof EVENT_NAMES)[number];

export type TEventMap = {
  // RTCSession events
  peerconnection: { peerconnection: RTCPeerConnection };
  connecting: unknown;
  sending: unknown;
  progress: unknown;
  accepted: unknown;
  confirmed: unknown;
  ended: EndEvent;
  failed: EndEvent;
  newDTMF: { originator: `${Originator}` };
  newInfo: IncomingInfoEvent | OutgoingInfoEvent;
  hold: unknown;
  unhold: unknown;
  muted: unknown;
  unmuted: unknown;
  reinvite: unknown;
  update: unknown;
  refer: unknown;
  replaces: unknown;
  sdp: unknown;
  icecandidate: unknown;
  getusermediafailed: unknown;
  'peerconnection:createofferfailed': unknown;
  'peerconnection:createanswerfailed': unknown;
  'peerconnection:setlocaldescriptionfailed': unknown;
  'peerconnection:setremotedescriptionfailed': unknown;
  // presentation events
  'presentation:start': MediaStream;
  'presentation:started': MediaStream;
  'presentation:end': MediaStream;
  'presentation:ended': MediaStream;
  'presentation:failed': Error;
  // synthetic events
  'start-call': {
    number: string;
    answer: boolean;
  };
  'peerconnection:confirmed': RTCPeerConnection;
  'peerconnection:ontrack': RTCTrackEvent;
  'ended:fromserver': EndEvent;
  'call-status-changed': { isCallActive: boolean };
  'remote-tracks-changed': {
    streams: TRemoteStreams;
    changeType: TRemoteTracksChangeType;
    participantId: string;
    trackId: string;
  };
  'remote-streams-changed': {
    streams: TRemoteStreams;
  };
  'recv-session-started': never;
  'recv-session-ended': never;
  'recv-quality-changed': {
    effectiveQuality: TEffectiveQuality;
    previousQuality: TRecvQuality;
    quality: TRecvQuality;
  };
};

export type TEvents = TypedEvents<TEventMap>;

export const createEvents = () => {
  return new TypedEvents<TEventMap>(EVENT_NAMES);
};
