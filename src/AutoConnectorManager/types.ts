import type { ConnectionManager, TParametersConnection } from '@/ConnectionManager';
import type { ConnectionQueueManager } from '@/ConnectionQueueManager';

export interface IAutoConnectorOptions {
  checkTelephonyRequestInterval?: number;
  timeoutBetweenAttempts?: number;
  onBeforeRetry?: () => Promise<void>;
  canRetryOnError?: (error: unknown) => boolean;
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
