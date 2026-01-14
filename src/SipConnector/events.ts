import { TypedEvents } from 'events-constructor';

import { API_MANAGER_EVENT_NAMES } from '@/ApiManager';
import { AUTO_CONNECTOR_MANAGER_EVENT_NAMES } from '@/AutoConnectorManager';
import { CALL_MANAGER_EVENT_NAMES } from '@/CallManager';
import { CONNECTION_MANAGER_EVENT_NAMES } from '@/ConnectionManager';
import { INCOMING_CALL_MANAGER_EVENT_NAMES } from '@/IncomingCallManager';
import { MAIN_STREAM_HEALTH_MONITOR_EVENT_NAMES } from '@/MainStreamHealthMonitor';
import { PRESENTATION_MANAGER_EVENT_NAMES } from '@/PresentationManager';
import { STATS_MANAGER_EVENT_NAMES } from '@/StatsManager';
import { VIDEO_SENDING_BALANCER_MANAGER_EVENT_NAMES } from '@/VideoSendingBalancerManager';

import type { TApiManagerEventMap } from '@/ApiManager';
import type { TAutoConnectorManagerEventMap } from '@/AutoConnectorManager';
import type { TCallManagerEventMap } from '@/CallManager';
import type {
  TConnectionConfigurationWithUa,
  TConnectionManagerEventMap,
} from '@/ConnectionManager';
import type { TIncomingCallManagerEventMap } from '@/IncomingCallManager';
import type { TMainStreamHealthMonitorEventMap } from '@/MainStreamHealthMonitor';
import type { TPresentationManagerEventMap } from '@/PresentationManager';
import type { TStatsManagerEventMap } from '@/StatsManager';
import type { TVideoSendingBalancerManagerEventMap } from '@/VideoSendingBalancerManager';

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
const VIDEO_BALANCER_EVENTS = VIDEO_SENDING_BALANCER_MANAGER_EVENT_NAMES.map((eventName) => {
  return `video-balancer:${eventName}` as const;
});
const MAIN_STREAM_HEALTH_EVENTS = MAIN_STREAM_HEALTH_MONITOR_EVENT_NAMES.map((eventName) => {
  return `main-stream-health:${eventName}` as const;
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
  ...MAIN_STREAM_HEALTH_EVENTS,
  ...SIP_CONNECTOR_EVENTS,
] as const;

export type TEventName = (typeof EVENT_NAMES)[number];

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
  PrefixedEventMap<TVideoSendingBalancerManagerEventMap, 'video-balancer'> &
  PrefixedEventMap<TMainStreamHealthMonitorEventMap, 'main-stream-health'> &
  TSipConnectorEventMap;

export type TEvents = TypedEvents<TEventMap>;

export const createEvents = () => {
  return new TypedEvents<TEventMap>(EVENT_NAMES);
};
