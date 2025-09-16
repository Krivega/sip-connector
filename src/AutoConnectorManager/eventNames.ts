/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import type { Events } from 'events-constructor';

export enum EEvent {
  CONNECTED = 'connected',
  BEFORE_ATTEMPT = 'before-attempt',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export const EVENT_NAMES = [
  `${EEvent.CONNECTED}`,
  `${EEvent.BEFORE_ATTEMPT}`,
  `${EEvent.FAILED}`,
  `${EEvent.CANCELLED}`,
] as const;

export type TEvent = (typeof EVENT_NAMES)[number];
export type TEvents = Events<typeof EVENT_NAMES>;
