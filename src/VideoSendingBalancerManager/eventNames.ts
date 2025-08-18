/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import type { TypedEvents } from 'events-constructor';

export enum EEvent {
  BALANCING_SCHEDULED = 'balancing-scheduled',
  BALANCING_STARTED = 'balancing-started',
  BALANCING_STOPPED = 'balancing-stopped',
  PARAMETERS_UPDATED = 'parameters-updated',
}

export const EVENT_NAMES = [
  `${EEvent.BALANCING_SCHEDULED}`,
  `${EEvent.BALANCING_STARTED}`,
  `${EEvent.BALANCING_STOPPED}`,
  `${EEvent.PARAMETERS_UPDATED}`,
] as const;

export type TEvent = (typeof EVENT_NAMES)[number];

export type TEventMap = {
  'balancing-scheduled': { delay: number };
  'balancing-started': { delay: number };
  'balancing-stopped': Record<string, never>;
  'parameters-updated': RTCRtpSendParameters;
};

export type TEvents = TypedEvents<TEventMap>;
