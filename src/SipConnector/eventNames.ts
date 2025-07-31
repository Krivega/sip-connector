import type { Events } from 'events-constructor';
import { EVENT_NAMES as API_MANAGER_EVENT_NAMES } from '../ApiManager/eventNames';
import { EVENT_NAMES as CALL_MANAGER_EVENT_NAMES } from '../CallManager/eventNames';
import { EVENT_NAMES as CONNECTION_MANAGER_EVENT_NAMES } from '../ConnectionManager/eventNames';
import { EVENT_NAMES as INCOMING_CALL_MANAGER_EVENT_NAMES } from '../IncomingCallManager/eventNames';
import { EVENT_NAMES as PRESENTATION_MANAGER_EVENT_NAMES } from '../PresentationManager/eventNames';

// Добавляем префиксы к событиям от разных менеджеров
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

export const EVENT_NAMES = [
  ...CONNECTION_EVENTS,
  ...CALL_EVENTS,
  ...API_EVENTS,
  ...INCOMING_CALL_EVENTS,
  ...PRESENTATION_EVENTS,
] as const;

export type TEvent = (typeof EVENT_NAMES)[number];
export type TEvents = Events<typeof EVENT_NAMES>;
