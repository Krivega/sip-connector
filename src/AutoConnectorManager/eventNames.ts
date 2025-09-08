/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import type { TypedEvents } from 'events-constructor';

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

export type TEventMap = {
  connected: Record<string, never>;
  'before-attempt': Record<string, never>;
  failed: { isRequestTimeoutError: boolean };
  cancelled: Record<string, never>;
};

export type TEvents = TypedEvents<TEventMap>;
