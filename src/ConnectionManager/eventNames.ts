/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import type {
  ConnectingEventUA,
  ConnectedEvent,
  DisconnectEvent,
  RegisteredEvent,
  UnRegisteredEvent,
  RTCSessionEvent,
  IncomingMessageEvent,
  OutgoingMessageEvent,
  IncomingRequest,
} from '@krivega/jssip';
import type { TypedEvents } from 'events-constructor';
import type { TConnectionConfigurationWithUa } from './ConnectionFlow';

export enum EEvent {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  DISCONNECTING = 'disconnecting',
  NEW_RTC_SESSION = 'newRTCSession',
  REGISTERED = 'registered',
  UNREGISTERED = 'unregistered',
  REGISTRATION_FAILED = 'registrationFailed',
  NEW_MESSAGE = 'newMessage',
  SIP_EVENT = 'sipEvent',
  CONNECT_STARTED = 'connect-started',
  CONNECT_SUCCEEDED = 'connect-succeeded',
  CONNECT_FAILED = 'connect-failed',
  CONNECT_PARAMETERS_RESOLVE_FAILED = 'connect-parameters-resolve-failed',
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

const SYNTHETICS_EVENT_NAMES = [
  `${EEvent.DISCONNECTING}`,
  `${EEvent.CONNECT_STARTED}`,
  `${EEvent.CONNECT_SUCCEEDED}`,
  `${EEvent.CONNECT_FAILED}`,
  `${EEvent.CONNECT_PARAMETERS_RESOLVE_FAILED}`,
] as const;

export const EVENT_NAMES = [...UA_EVENT_NAMES, ...SYNTHETICS_EVENT_NAMES] as const;

export type TEvent = (typeof EVENT_NAMES)[number];

export type TEventMap = {
  connecting: ConnectingEventUA;
  connected: ConnectedEvent;
  disconnected: DisconnectEvent;
  disconnecting: Record<string, never>;
  newRTCSession: RTCSessionEvent;
  registered: RegisteredEvent;
  unregistered: UnRegisteredEvent;
  registrationFailed: UnRegisteredEvent;
  newMessage: IncomingMessageEvent | OutgoingMessageEvent;
  sipEvent: { event: unknown; request: IncomingRequest };
  'connect-started': Record<string, never>;
  'connect-succeeded': TConnectionConfigurationWithUa;
  'connect-failed': unknown;
  'connect-parameters-resolve-failed': unknown;
};

export type TEvents = TypedEvents<TEventMap>;
