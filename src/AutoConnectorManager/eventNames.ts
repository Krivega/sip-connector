/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import type { TypedEvents } from 'events-constructor';
import type { TAttemptStatus } from './types';

export enum EEvent {
  BEFORE_ATTEMPT = 'before-attempt',
  SUCCESS = 'success',
  FAILED_ALL_ATTEMPTS = 'failed-all-attempts',
  CANCELLED_ATTEMPTS = 'cancelled-attempts',
  CHANGED_ATTEMPT_STATUS = 'changed-attempt-status',
  STOP_ATTEMPTS_BY_ERROR = 'stop-attempts-by-error',
  LIMIT_REACHED_ATTEMPTS = 'limit-reached-attempts',
}

export const EVENT_NAMES = [
  `${EEvent.BEFORE_ATTEMPT}`,
  `${EEvent.SUCCESS}`,
  `${EEvent.FAILED_ALL_ATTEMPTS}`,
  `${EEvent.CANCELLED_ATTEMPTS}`,
  `${EEvent.CHANGED_ATTEMPT_STATUS}`,
  `${EEvent.STOP_ATTEMPTS_BY_ERROR}`,
  `${EEvent.LIMIT_REACHED_ATTEMPTS}`,
] as const;

export type TEventMap = {
  'before-attempt': Record<string, never>;
  success: never;
  'failed-all-attempts': Error;
  'cancelled-attempts': unknown;
  'changed-attempt-status': TAttemptStatus;
  'stop-attempts-by-error': unknown;
  'limit-reached-attempts': Error;
};

export type TEvents = TypedEvents<TEventMap>;
