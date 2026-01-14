/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import { TypedEvents } from 'events-constructor';

import type { RTCSession } from '@krivega/jssip';

export enum EEvent {
  RINGING = 'ringing',
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
  `${EEvent.RINGING}`,
  `${EEvent.DECLINED_INCOMING_CALL}`,
  `${EEvent.TERMINATED_INCOMING_CALL}`,
  `${EEvent.FAILED_INCOMING_CALL}`,
] as const;

export type TRemoteCallerData = {
  displayName?: string;
  host?: string;
  incomingNumber?: string;
  rtcSession?: RTCSession;
};

export type TEventMap = {
  ringing: TRemoteCallerData;
  declinedIncomingCall: TRemoteCallerData;
  terminatedIncomingCall: TRemoteCallerData;
  failedIncomingCall: TRemoteCallerData;
};

export type TEvents = TypedEvents<TEventMap>;

export const createEvents = () => {
  return new TypedEvents<TEventMap>(EVENT_NAMES);
};
