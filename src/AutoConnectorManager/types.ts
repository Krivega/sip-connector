import type { ConnectionManager } from '@/ConnectionManager';
import type { ConnectionQueueManager } from '@/ConnectionQueueManager';

export interface IAutoConnectorOptions {
  checkTelephonyRequestInterval?: number;
  timeoutBetweenAttempts?: number;
  clearCache?: () => Promise<void>;
}
export type ISubscriber<T = void> = {
  subscribe: (callback: (value: T) => void) => void;
  unsubscribe: () => void;
};

export type TParametersCheckTelephony = Parameters<ConnectionManager['checkTelephony']>[0];
export type TParametersConnect = Parameters<ConnectionQueueManager['connect']>[0];
export type TParametersAutoConnect = {
  getConnectParameters: () => Promise<TParametersConnect | undefined>;
  getCheckTelephonyParameters: () => Promise<TParametersCheckTelephony>;
  hasReadyForConnection?: () => boolean;
};
