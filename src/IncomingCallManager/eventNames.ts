/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import type { RTCSession } from '@krivega/jssip';
import type { TypedEvents } from 'events-constructor';

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
  `${EEvent.INCOMING_CALL}`,
  `${EEvent.DECLINED_INCOMING_CALL}`,
  `${EEvent.TERMINATED_INCOMING_CALL}`,
  `${EEvent.FAILED_INCOMING_CALL}`,
] as const;

export type TEvent = (typeof EVENT_NAMES)[number];

export type TRemoteCallerData = {
  displayName?: string;
  host?: string;
  incomingNumber?: string;
  rtcSession?: RTCSession;
};

export type TEventMap = {
  incomingCall: TRemoteCallerData;
  declinedIncomingCall: TRemoteCallerData;
  terminatedIncomingCall: TRemoteCallerData;
  failedIncomingCall: TRemoteCallerData;
};

export type TEvents = TypedEvents<TEventMap>;
