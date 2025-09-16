/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import type { TypedEvents } from 'events-constructor';

export enum EEvent {
  CONNECTED = 'connected',
  BEFORE_ATTEMPT = 'before-attempt',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  ATTEMPT_STATUS_CHANGED = 'attempt-status-changed',
}

export const EVENT_NAMES = [
  `${EEvent.CONNECTED}`,
  `${EEvent.BEFORE_ATTEMPT}`,
  `${EEvent.FAILED}`,
  `${EEvent.CANCELLED}`,
  `${EEvent.ATTEMPT_STATUS_CHANGED}`,
] as const;

export type TEventMap = {
  connected: Record<string, never>;
  'before-attempt': Record<string, never>;
  failed: unknown;
  cancelled: Record<string, never>;
  'attempt-status-changed': boolean;
};

export type TEvents = TypedEvents<TEventMap>;
