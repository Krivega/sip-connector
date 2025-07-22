export enum EEvent {
  INCOMING_CALL = 'incomingCall',
  DECLINED_INCOMING_CALL = 'declinedIncomingCall',
  TERMINATED_INCOMING_CALL = 'terminatedIncomingCall',
  FAILED_INCOMING_CALL = 'failedIncomingCall',
}

export enum Originator {
  LOCAL = 'local',
  REMOTE = 'remote',
  SYSTEM = 'system',
}

export const EVENT_NAMES = [
  EEvent.INCOMING_CALL,
  EEvent.DECLINED_INCOMING_CALL,
  EEvent.TERMINATED_INCOMING_CALL,
  EEvent.FAILED_INCOMING_CALL,
] as const;

export type TEvent = (typeof EVENT_NAMES)[number];
