import type { ConnectionManager } from '@/ConnectionManager';
import type { ConnectionQueueManager } from '@/ConnectionQueueManager';

export interface IAutoConnectorOptions {
  checkTelephonyRequestInterval: number;
  timeoutBetweenAttempts?: number;
}
export type ISubscriber = {
  subscribe: (callback: () => void) => void;
  unsubscribe: () => void;
};

export type TErrorSipConnector = Error & { cause: string };
export type TParametersCheckTelephony = Parameters<ConnectionManager['checkTelephony']>[0];
export type TParametersConnect = Parameters<ConnectionQueueManager['connect']>[0];
export type TParametersAutoConnect = {
  getConnectParameters: () => Promise<TParametersConnect>;
  getCheckTelephonyParameters: () => TParametersCheckTelephony;
  hasReadyForConnection?: () => boolean;
  clearCache?: () => Promise<void>;
  connectorSubscriber?: ISubscriber;
};
