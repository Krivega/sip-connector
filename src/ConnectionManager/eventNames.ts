/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import type { Events } from 'events-constructor';

export enum EEvent {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  NEW_RTC_SESSION = 'newRTCSession',
  REGISTERED = 'registered',
  UNREGISTERED = 'unregistered',
  REGISTRATION_FAILED = 'registrationFailed',
  NEW_MESSAGE = 'newMessage',
  SIP_EVENT = 'sipEvent',
}

export const UA_EVENT_NAMES = [
  `${EEvent.CONNECTING}`,
  `${EEvent.CONNECTED}`,
  `${EEvent.DISCONNECTED}`,
  `${EEvent.NEW_RTC_SESSION}`,
  `${EEvent.REGISTERED}`,
  `${EEvent.UNREGISTERED}`,
  `${EEvent.REGISTRATION_FAILED}`,
  `${EEvent.NEW_MESSAGE}`,
  `${EEvent.SIP_EVENT}`,
] as const;

export const EVENT_NAMES = [...UA_EVENT_NAMES];

export type TEvent = (typeof EVENT_NAMES)[number];
export type TEvents = Events<typeof EVENT_NAMES>;
