/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import { TypedEvents } from 'events-constructor';

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

export type TEventMap = {
  'balancing-scheduled': { delay: number };
  'balancing-started': { delay: number };
  'balancing-stopped': Record<string, never>;
  'parameters-updated': RTCRtpSendParameters;
};

export type TEvents = TypedEvents<TEventMap>;

export const createEvents = () => {
  return new TypedEvents<TEventMap>(EVENT_NAMES);
};
