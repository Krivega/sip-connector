export enum EEvent {
  // rtcSession events
  PEER_CONNECTION = 'peerconnection',
  CONFIRMED = 'confirmed',
  ENDED = 'ended',
  FAILED = 'failed',
  NEW_INFO = 'newInfo',

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
  EEvent.PEER_CONNECTION,
  EEvent.CONFIRMED,
  EEvent.ENDED,
  EEvent.FAILED,
  EEvent.NEW_INFO,
  EEvent.PEER_CONNECTION_CONFIRMED,
  EEvent.PEER_CONNECTION_ONTRACK,
  EEvent.ENDED_FROM_SERVER,
] as const;

export type TEvent = (typeof EVENT_NAMES)[number];
