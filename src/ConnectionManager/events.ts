/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import { TypedEvents } from 'events-constructor';

import type {
  ConnectedEvent,
  ConnectingEventUA,
  DisconnectEvent,
  IncomingMessageEvent,
  IncomingRequest,
  OutgoingMessageEvent,
  RegisteredEvent,
  RTCSessionEvent,
  UnRegisteredEvent,
  RegistrationFailedEvent,
} from '@krivega/jssip';
import type { TConnectionConfiguration } from './ConfigurationManager';
import type { TParametersConnection } from './ConnectionFlow';

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
  CONNECT_PARAMETERS_RESOLVE_SUCCESS = 'connect-parameters-resolve-success',
  CONNECT_PARAMETERS_RESOLVE_FAILED = 'connect-parameters-resolve-failed',
  CONNECTED_WITH_CONFIGURATION = 'connected-with-configuration',
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
  `${EEvent.CONNECT_PARAMETERS_RESOLVE_SUCCESS}`,
  `${EEvent.CONNECT_PARAMETERS_RESOLVE_FAILED}`,
  `${EEvent.CONNECTED_WITH_CONFIGURATION}`,
] as const;

export const EVENT_NAMES = [...UA_EVENT_NAMES, ...SYNTHETICS_EVENT_NAMES] as const;

export type TEventMap = {
  connecting: ConnectingEventUA;
  connected: ConnectedEvent;
  disconnected: DisconnectEvent;
  disconnecting: Record<string, never>;
  newRTCSession: RTCSessionEvent;
  registered: RegisteredEvent;
  unregistered: UnRegisteredEvent;
  registrationFailed: RegistrationFailedEvent;
  newMessage: IncomingMessageEvent | OutgoingMessageEvent;
  sipEvent: { event: unknown; request: IncomingRequest };
  'connect-started': Record<string, never>;
  'connect-succeeded': TConnectionConfiguration;
  'connected-with-configuration': TConnectionConfiguration;
  'connect-failed': unknown;
  'connect-parameters-resolve-success': TParametersConnection;
  'connect-parameters-resolve-failed': unknown;
};

export type TEvents = TypedEvents<TEventMap>;

export const createEvents = () => {
  return new TypedEvents<TEventMap>(EVENT_NAMES);
};
