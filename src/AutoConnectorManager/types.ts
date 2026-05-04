import type { ConnectionManager, TParametersConnection } from '@/ConnectionManager';
import type { ConnectionQueueManager } from '@/ConnectionQueueManager';

// Стратегия обработки сетевого события (за исключением offline — у него свой таймаут).
export type TNetworkEventPolicy = 'ignore' | 'probe' | 'reconnect';

// Лёгкая проверка доступности сервера. true — сервер отвечает, reconnect не нужен.
export type TNetworkProbe = () => Promise<boolean>;

export type TNetworkEventsHandlers = {
  onChange: () => void;
  onOnline: () => void;
  onOffline: () => void;
};

export type INetworkEventsSubscriber = {
  subscribe: (handlers: TNetworkEventsHandlers) => void;
  unsubscribe: () => void;
};

export interface IAutoConnectorOptions {
  checkTelephonyRequestInterval?: number;
  timeoutBetweenAttempts?: number;
  canRetryOnError?: (error: unknown) => boolean;
  telephonyFailPolicy?: Partial<ITelephonyFailPolicyOptions>;
  networkEventsSubscriber?: INetworkEventsSubscriber;
  // Окно ожидания при offline, в течение которого короткий "мигающий" обрыв сети
  // не приводит к разрыву активного соединения.
  offlineGraceMs?: number;
  // Как реагировать на смену характеристик сети (`navigator.connection.change`).
  // 'probe' (по умолчанию) — проверить сервер ping-ом и reconnect только при неудаче.
  // 'reconnect' — всегда безусловный reconnect.
  // 'ignore' — не реагировать на смену сети (положиться на периодический ping / JsSIP transport).
  onNetworkChangePolicy?: TNetworkEventPolicy;
  // Как реагировать на `window.online`. Дефолт — 'probe' по той же причине:
  // событие online не гарантирует, что наш сервер достижим.
  onNetworkOnlinePolicy?: TNetworkEventPolicy;
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

export type TAutoConnectStartSuccessResult = {
  isSuccess: true;
  reason: 'started';
};

export type TAutoConnectStartFailureResult = {
  isSuccess: false;
  reason:
    | 'coalesced'
    | 'failed-all-attempts'
    | 'stop-attempts-by-error'
    | 'limit-reached-attempts'
    | 'unexpected';
  error?: unknown;
};

export type TAutoConnectStartResult =
  | TAutoConnectStartSuccessResult
  | TAutoConnectStartFailureResult;

export const RECONNECT_REASONS = {
  START: 'start',
  MANUAL_RESTART: 'manual-restart',
  REGISTRATION_FAILED_OUT_OF_CALL: 'registration-failed-out-of-call',
  TELEPHONY_DISCONNECTED: 'telephony-disconnected',
  TELEPHONY_CHECK_FAILED: 'telephony-check-failed',
  /** Порог неуспешных периодических SIP OPTIONS (`PingServerRequester`) в `connectedMonitoring`. */
  PERIODIC_PING_FAILED: 'periodic-ping-failed',
  NETWORK_ONLINE: 'network-online',
  NETWORK_CHANGE: 'network-change',
} as const;

export type TReconnectReason = (typeof RECONNECT_REASONS)[keyof typeof RECONNECT_REASONS];

// Чем выше число, тем выше приоритет причины в окне coalescing.
export const RECONNECT_REASON_PRIORITY: Record<TReconnectReason, number> = {
  [RECONNECT_REASONS.START]: 0,
  [RECONNECT_REASONS.TELEPHONY_DISCONNECTED]: 1,
  [RECONNECT_REASONS.TELEPHONY_CHECK_FAILED]: 1,
  [RECONNECT_REASONS.PERIODIC_PING_FAILED]: 2,
  [RECONNECT_REASONS.REGISTRATION_FAILED_OUT_OF_CALL]: 3,
  [RECONNECT_REASONS.MANUAL_RESTART]: 4,
  [RECONNECT_REASONS.NETWORK_ONLINE]: 4,
  [RECONNECT_REASONS.NETWORK_CHANGE]: 4,
} as const;

export const getReconnectReasonPriority = (reason: TReconnectReason): number => {
  return RECONNECT_REASON_PRIORITY[reason];
};
