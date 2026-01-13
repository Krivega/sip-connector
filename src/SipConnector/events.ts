import { TypedEvents } from 'events-constructor';

import { EVENT_NAMES as API_MANAGER_EVENT_NAMES } from '@/ApiManager/events';
import { EVENT_NAMES as AUTO_CONNECTOR_MANAGER_EVENT_NAMES } from '@/AutoConnectorManager/events';
import { EVENT_NAMES as CALL_MANAGER_EVENT_NAMES } from '@/CallManager/events';
import { EVENT_NAMES as CONNECTION_MANAGER_EVENT_NAMES } from '@/ConnectionManager/events';
import { EVENT_NAMES as INCOMING_CALL_MANAGER_EVENT_NAMES } from '@/IncomingCallManager/events';
import { EVENT_NAMES as PRESENTATION_MANAGER_EVENT_NAMES } from '@/PresentationManager/events';
import { EVENT_NAMES as STATS_MANAGER_EVENT_NAMES } from '@/StatsManager/events';
import { EVENT_NAMES as VIDEO_BALANCER_MANAGER_EVENT_NAMES } from '@/VideoSendingBalancerManager/events';

import type { TEventMap as TApiManagerEventMap } from '@/ApiManager/events';
import type { TEventMap as TAutoConnectorManagerEventMap } from '@/AutoConnectorManager/events';
import type { TEventMap as TCallManagerEventMap } from '@/CallManager/events';
import type { TConnectionConfigurationWithUa } from '@/ConnectionManager';
import type { TEventMap as TConnectionManagerEventMap } from '@/ConnectionManager/events';
import type { TEventMap as TIncomingCallManagerEventMap } from '@/IncomingCallManager/events';
import type { TEventMap as TPresentationManagerEventMap } from '@/PresentationManager/events';
import type { TEventMap as TStatsManagerEventMap } from '@/StatsPeerConnection/events';
import type { TEventMap as TVideoBalancerManagerEventMap } from '@/VideoSendingBalancerManager/events';

// Добавляем префиксы к событиям от разных менеджеров
const AUTO_CONNECTOR_EVENTS = AUTO_CONNECTOR_MANAGER_EVENT_NAMES.map((eventName) => {
  return `auto-connect:${eventName}` as const;
});
const CONNECTION_EVENTS = CONNECTION_MANAGER_EVENT_NAMES.map((eventName) => {
  return `connection:${eventName}` as const;
});
const CALL_EVENTS = CALL_MANAGER_EVENT_NAMES.map((eventName) => {
  return `call:${eventName}` as const;
});
const API_EVENTS = API_MANAGER_EVENT_NAMES.map((eventName) => {
  return `api:${eventName}` as const;
});
const INCOMING_CALL_EVENTS = INCOMING_CALL_MANAGER_EVENT_NAMES.map((eventName) => {
  return `incoming-call:${eventName}` as const;
});
const PRESENTATION_EVENTS = PRESENTATION_MANAGER_EVENT_NAMES.map((eventName) => {
  return `presentation:${eventName}` as const;
});
const STATS_EVENTS = STATS_MANAGER_EVENT_NAMES.map((eventName) => {
  return `stats:${eventName}` as const;
});
const VIDEO_BALANCER_EVENTS = VIDEO_BALANCER_MANAGER_EVENT_NAMES.map((eventName) => {
  return `video-balancer:${eventName}` as const;
});

const SIP_CONNECTOR_EVENTS = [
  'disconnected-from-out-of-call',
  'connected-with-configuration-from-out-of-call',
  'stopped-presentation-by-server-command',
] as const;

export const EVENT_NAMES = [
  ...AUTO_CONNECTOR_EVENTS,
  ...CONNECTION_EVENTS,
  ...CALL_EVENTS,
  ...API_EVENTS,
  ...INCOMING_CALL_EVENTS,
  ...PRESENTATION_EVENTS,
  ...STATS_EVENTS,
  ...VIDEO_BALANCER_EVENTS,
  ...SIP_CONNECTOR_EVENTS,
] as const;

export type TEvent = (typeof EVENT_NAMES)[number];

// Создаем TEventMap для SipConnector, объединяя все TEventMap с префиксами
type PrefixedEventMap<T extends Record<string, unknown>, Prefix extends string> = {
  [K in keyof T as `${Prefix}:${string & K}`]: T[K];
};

type TSipConnectorEventMap = {
  'disconnected-from-out-of-call': Record<string, never>;
  'connected-with-configuration-from-out-of-call': TConnectionConfigurationWithUa;
  'stopped-presentation-by-server-command': Record<string, never>;
};

export type TEventMap = PrefixedEventMap<TAutoConnectorManagerEventMap, 'auto-connect'> &
  PrefixedEventMap<TConnectionManagerEventMap, 'connection'> &
  PrefixedEventMap<TCallManagerEventMap, 'call'> &
  PrefixedEventMap<TApiManagerEventMap, 'api'> &
  PrefixedEventMap<TIncomingCallManagerEventMap, 'incoming-call'> &
  PrefixedEventMap<TPresentationManagerEventMap, 'presentation'> &
  PrefixedEventMap<TStatsManagerEventMap, 'stats'> &
  PrefixedEventMap<TVideoBalancerManagerEventMap, 'video-balancer'> &
  TSipConnectorEventMap;

export type TEvents = TypedEvents<TEventMap>;

export const createEvents = () => {
  return new TypedEvents<TEventMap>(EVENT_NAMES);
};
