/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import { TypedEvents } from 'events-constructor';

import type { TAttemptStatus } from './types';

enum EEvent {
  BEFORE_ATTEMPT = 'before-attempt',
  SUCCESS = 'success',
  FAILED_ALL_ATTEMPTS = 'failed-all-attempts',
  CANCELLED_ATTEMPTS = 'cancelled-attempts',
  CHANGED_ATTEMPT_STATUS = 'changed-attempt-status',
  STOP_ATTEMPTS_BY_ERROR = 'stop-attempts-by-error',
  LIMIT_REACHED_ATTEMPTS = 'limit-reached-attempts',
  TELEPHONY_CHECK_FAILURE = 'telephony-check-failure',
  TELEPHONY_CHECK_ESCALATED = 'telephony-check-escalated',
}

export const EVENT_NAMES = [
  `${EEvent.BEFORE_ATTEMPT}`,
  `${EEvent.SUCCESS}`,
  `${EEvent.FAILED_ALL_ATTEMPTS}`,
  `${EEvent.CANCELLED_ATTEMPTS}`,
  `${EEvent.CHANGED_ATTEMPT_STATUS}`,
  `${EEvent.STOP_ATTEMPTS_BY_ERROR}`,
  `${EEvent.LIMIT_REACHED_ATTEMPTS}`,
  `${EEvent.TELEPHONY_CHECK_FAILURE}`,
  `${EEvent.TELEPHONY_CHECK_ESCALATED}`,
] as const;

export type TEventMap = {
  'before-attempt': Record<string, never>;
  success: never;
  'failed-all-attempts': Error;
  'cancelled-attempts': unknown;
  'changed-attempt-status': TAttemptStatus;
  'stop-attempts-by-error': unknown;
  'limit-reached-attempts': Error;
  'telephony-check-failure': {
    failCount: number;
    escalationLevel: 'none' | 'warning' | 'critical';
    shouldRequestReconnect: boolean;
    nextRetryDelayMs: number;
    error: unknown;
  };
  'telephony-check-escalated': {
    failCount: number;
    escalationLevel: 'warning' | 'critical';
    error: unknown;
  };
};

export type TEvents = TypedEvents<TEventMap>;
export const createEvents = () => {
  return new TypedEvents<TEventMap>(EVENT_NAMES);
};
