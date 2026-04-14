import type { ConnectionManager, TParametersConnection } from '@/ConnectionManager';
import type { ConnectionQueueManager } from '@/ConnectionQueueManager';

export interface IAutoConnectorOptions {
  checkTelephonyRequestInterval?: number;
  timeoutBetweenAttempts?: number;
  canRetryOnError?: (error: unknown) => boolean;
  telephonyFailPolicy?: Partial<ITelephonyFailPolicyOptions>;
}

export interface ITelephonyFailPolicyOptions {
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;
  warningThreshold: number;
  criticalThreshold: number;
}
export type ISubscriber<T = void> = {
  subscribe: (callback: (value: T) => void) => void;
  unsubscribe: () => void;
};

export type TParametersCheckTelephony = Parameters<ConnectionManager['checkTelephony']>[0];

type TOptionsConnect = Parameters<ConnectionQueueManager['connect']>[1];

export type TParametersAutoConnect = {
  getParameters: () => Promise<TParametersConnection & TParametersCheckTelephony>;
  options?: TOptionsConnect;
};
export type TAttemptStatus = {
  isInProgress: boolean;
};

export const RECONNECT_REASONS = {
  START: 'start',
  MANUAL_RESTART: 'manual-restart',
  REGISTRATION_FAILED_OUT_OF_CALL: 'registration-failed-out-of-call',
  TELEPHONY_DISCONNECTED: 'telephony-disconnected',
  TELEPHONY_CHECK_FAILED: 'telephony-check-failed',
} as const;

export type TReconnectReason = (typeof RECONNECT_REASONS)[keyof typeof RECONNECT_REASONS];

// Чем выше число, тем выше приоритет причины в окне coalescing.
export const RECONNECT_REASON_PRIORITY: Record<TReconnectReason, number> = {
  [RECONNECT_REASONS.START]: 0,
  [RECONNECT_REASONS.TELEPHONY_DISCONNECTED]: 1,
  [RECONNECT_REASONS.TELEPHONY_CHECK_FAILED]: 1,
  [RECONNECT_REASONS.REGISTRATION_FAILED_OUT_OF_CALL]: 3,
  [RECONNECT_REASONS.MANUAL_RESTART]: 4,
} as const;

export const getReconnectReasonPriority = (reason: TReconnectReason): number => {
  return RECONNECT_REASON_PRIORITY[reason];
};
