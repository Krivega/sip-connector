/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import type Events from 'events-constructor';

export enum EEvent {
  // rtcSession events
  PEER_CONNECTION = 'peerconnection',
  CONFIRMED = 'confirmed',
  ENDED = 'ended',
  FAILED = 'failed',
  NEW_INFO = 'newInfo',
  NEW_DTMF = 'newDTMF',
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

export const EVENT_NAMES = [
  `${EEvent.PEER_CONNECTION}`,
  `${EEvent.CONFIRMED}`,
  `${EEvent.ENDED}`,
  `${EEvent.FAILED}`,
  `${EEvent.NEW_INFO}`,
  `${EEvent.NEW_DTMF}`,
  `${EEvent.PEER_CONNECTION_CONFIRMED}`,
  `${EEvent.PEER_CONNECTION_ONTRACK}`,
  `${EEvent.ENDED_FROM_SERVER}`,
  `${EEvent.START_PRESENTATION}`,
  `${EEvent.STARTED_PRESENTATION}`,
  `${EEvent.END_PRESENTATION}`,
  `${EEvent.ENDED_PRESENTATION}`,
  `${EEvent.FAILED_PRESENTATION}`,
] as const;

export type TEvent = (typeof EVENT_NAMES)[number];

export type TEvents = Events<typeof EVENT_NAMES>;
