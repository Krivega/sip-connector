/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import type { TypedEvents } from 'events-constructor';
import type { TAttemptStatus } from './types';

export enum EEvent {
  BEFORE_ATTEMPT = 'before-attempt',
  SUCCEEDED_ATTEMPT = 'succeeded-attempt',
  FAILED_ATTEMPT = 'failed-attempt',
  FAILED_ALL_ATTEMPTS = 'failed-all-attempts',
  CANCELLED_ATTEMPT = 'cancelled-attempt',
  CHANGED_ATTEMPT_STATUS = 'changed-attempt-status',
}

export const EVENT_NAMES = [
  `${EEvent.BEFORE_ATTEMPT}`,
  `${EEvent.SUCCEEDED_ATTEMPT}`,
  `${EEvent.FAILED_ATTEMPT}`,
  `${EEvent.FAILED_ALL_ATTEMPTS}`,
  `${EEvent.CANCELLED_ATTEMPT}`,
  `${EEvent.CHANGED_ATTEMPT_STATUS}`,
] as const;

export type TEventMap = {
  'before-attempt': Record<string, never>;
  'succeeded-attempt': Record<string, never>;
  'failed-attempt': Error;
  'failed-all-attempts': Error;
  'cancelled-attempt': Error;
  'changed-attempt-status': TAttemptStatus;
};

export type TEvents = TypedEvents<TEventMap>;
