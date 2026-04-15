import type { TParametersAutoConnect } from '../types';

export enum EState {
  IDLE = 'idle',
  DISCONNECTING = 'disconnecting',
  ATTEMPTING_GATE = 'attemptingGate',
  ATTEMPTING_CONNECT = 'attemptingConnect',
  WAITING_BEFORE_RETRY = 'waitingBeforeRetry',
  CONNECTED_MONITORING = 'connectedMonitoring',
  TELEPHONY_CHECKING = 'telephonyChecking',
  ERROR_TERMINAL = 'errorTerminal',
}

export type TAfterDisconnect = 'attempt' | 'idle';
export type TStopReason = 'halted' | 'cancelled' | 'failed';

type TBaseContext = {
  afterDisconnect: TAfterDisconnect;
};

export type TContextMap = {
  [EState.IDLE]: TBaseContext & {
    parameters: TParametersAutoConnect | undefined;
    stopReason: undefined;
    lastError: undefined;
  };
  [EState.DISCONNECTING]: TBaseContext & {
    parameters: TParametersAutoConnect | undefined;
    stopReason: undefined;
    lastError: undefined;
  };
  [EState.ATTEMPTING_GATE]: TBaseContext & {
    parameters: TParametersAutoConnect;
    afterDisconnect: 'attempt';
    stopReason: undefined;
    lastError: undefined;
  };
  [EState.ATTEMPTING_CONNECT]: TBaseContext & {
    parameters: TParametersAutoConnect;
    afterDisconnect: 'attempt';
    stopReason: undefined;
    lastError: undefined;
  };
  [EState.WAITING_BEFORE_RETRY]: TBaseContext & {
    parameters: TParametersAutoConnect;
    afterDisconnect: 'attempt';
    stopReason: undefined;
    lastError: undefined;
  };
  [EState.CONNECTED_MONITORING]: TBaseContext & {
    parameters: TParametersAutoConnect;
    afterDisconnect: 'attempt';
    stopReason: undefined;
    lastError: undefined;
  };
  [EState.TELEPHONY_CHECKING]: TBaseContext & {
    parameters: TParametersAutoConnect;
    afterDisconnect: 'attempt';
    stopReason: undefined;
    lastError: undefined;
  };
  [EState.ERROR_TERMINAL]: TBaseContext & {
    parameters: TParametersAutoConnect | undefined;
    afterDisconnect: 'attempt';
    stopReason: TStopReason | undefined;
    lastError: unknown;
  };
};

export type TContext = TContextMap[keyof TContextMap];

export type TAutoConnectorEvent =
  | { type: 'AUTO.STOP' }
  | { type: 'AUTO.RESTART'; parameters: TParametersAutoConnect }
  | {
      type: 'TELEPHONY.RESULT';
      outcome: 'stillConnected';
    };

/**
 * Внешние зависимости машины автоподключения: реализуются в `AutoConnectorManager`, чтобы машина
 * оставалась декларативной. Экспортируемый фабричный метод — `createAutoConnectorMachine`.
 */
export type TAutoConnectorMachineDeps = {
  /** Правило из опций: можно ли переподключаться после этой ошибки. */
  canRetryOnError: (error: unknown) => boolean;
  /** Нужно ли делать предварительный `disconnect` перед новой попыткой. */
  shouldDisconnectBeforeAttempt: () => boolean;
  /** Полная остановка текущего флоу: сброс попыток, стоп триггеров, `disconnect` очереди. */
  stopConnectionFlow: () => Promise<void>;
  /** Один вызов `connectionQueueManager.connect` с параметрами из контекста. */
  connect: (parameters: TParametersAutoConnect) => Promise<void>;
  /** Ожидание `timeoutBetweenAttempts` перед следующей попыткой. */
  delayBetweenAttempts: () => Promise<void>;
  /** Достигнут ли лимит попыток подряд (`AttemptsState`). */
  hasLimitReached: () => boolean;
  /** Перед новой попыткой: before-attempt и остановка connect-триггеров. */
  beforeAttempt: () => void;
  /** Вход в attemptingConnect: отметка начала попытки и инкремент счётчика. */
  beforeConnectAttempt: () => void;
  /** Обработчик ветки лимита попыток. */
  onLimitReached: (parameters: TParametersAutoConnect) => void;
  /** Успешный `connect`: подписки на мониторинг и `success`. */
  onConnectSucceeded: (parameters: TParametersAutoConnect) => void;
  /** Терминальный выход: завершение попытки + эмит итогового события. */
  emitTerminalOutcome: (context: {
    stopReason: TStopReason | undefined;
    lastError: unknown;
  }) => void;
  /** Уже подключены: остановить триггеры и `success` (ветка check-telephony). */
  onTelephonyStillConnected: () => void;
};
