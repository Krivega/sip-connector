/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import type { IncomingInfoEvent, OutgoingInfoEvent, EndEvent } from '@krivega/jssip';
import type { TypedEvents } from 'events-constructor';

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
  PEER_CONNECTION_CONFIRMED = 'peerconnection:confirmed',
  PEER_CONNECTION_ONTRACK = 'peerconnection:ontrack',
  ENDED_FROM_SERVER = 'ended:fromserver',
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
  `${EEvent.PEER_CONNECTION_CONFIRMED}`,
  `${EEvent.PEER_CONNECTION_ONTRACK}`,
  `${EEvent.ENDED_FROM_SERVER}`,
] as const;

export const EVENT_NAMES = [
  ...SESSION_JSSIP_EVENT_NAMES,
  ...SESSION_SYNTHETICS_EVENT_NAMES,
] as const;

export type TEvent = (typeof EVENT_NAMES)[number];

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
  'peerconnection:confirmed': RTCPeerConnection;
  'peerconnection:ontrack': RTCTrackEvent;
  'ended:fromserver': EndEvent;
};

export type TEvents = TypedEvents<TEventMap>;
