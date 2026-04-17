/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import { TypedEvents } from 'events-constructor';

import type { TCancelledReason } from './types';

enum EEvent {
  ARMED = 'armed',
  DISARMED = 'disarmed',
  FAILURE_DETECTED = 'failure-detected',
  ATTEMPT_SCHEDULED = 'attempt-scheduled',
  ATTEMPT_STARTED = 'attempt-started',
  ATTEMPT_SUCCEEDED = 'attempt-succeeded',
  ATTEMPT_FAILED = 'attempt-failed',
  WAITING_SIGNALING = 'waiting-signaling',
  LIMIT_REACHED = 'limit-reached',
  CANCELLED = 'cancelled',
  STATUS_CHANGED = 'status-changed',
}

export const EVENT_NAMES = [
  `${EEvent.ARMED}`,
  `${EEvent.DISARMED}`,
  `${EEvent.FAILURE_DETECTED}`,
  `${EEvent.ATTEMPT_SCHEDULED}`,
  `${EEvent.ATTEMPT_STARTED}`,
  `${EEvent.ATTEMPT_SUCCEEDED}`,
  `${EEvent.ATTEMPT_FAILED}`,
  `${EEvent.WAITING_SIGNALING}`,
  `${EEvent.LIMIT_REACHED}`,
  `${EEvent.CANCELLED}`,
  `${EEvent.STATUS_CHANGED}`,
] as const;

export type TEventMap = {
  armed: Record<string, never>;
  disarmed: Record<string, never>;
  'failure-detected': { cause: string; originator: string; attempt: number };
  'attempt-scheduled': { attempt: number; delayMs: number };
  'attempt-started': { attempt: number };
  'attempt-succeeded': { attempt: number };
  'attempt-failed': { attempt: number; error: unknown };
  'waiting-signaling': { timeoutMs: number };
  'limit-reached': { attempts: number };
  cancelled: { reason: TCancelledReason };
  'status-changed': { isReconnecting: boolean };
};

export type TEvents = TypedEvents<TEventMap>;

export const createEvents = () => {
  return new TypedEvents<TEventMap>(EVENT_NAMES);
};
