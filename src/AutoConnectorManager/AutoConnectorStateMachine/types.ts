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

export type TAutoConnectorContext = {
  parameters: TParametersAutoConnect | undefined;
  afterDisconnect: TAfterDisconnect;
  stopReason: TStopReason | undefined;
  lastError: unknown;
};

export type TAutoConnectorEvent =
  | { type: 'AUTO.STOP' }
  | { type: 'AUTO.RESTART'; parameters: TParametersAutoConnect }
  | { type: 'FLOW.RESTART' }
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
  /** Полная остановка текущего флоу: сброс попыток, стоп триггеров, `disconnect` очереди. */
  stopConnectionFlow: () => Promise<void>;
  /** Один вызов `connectionQueueManager.connect` с параметрами из контекста. */
  connect: (parameters: TParametersAutoConnect) => Promise<void>;
  /** Ожидание `timeoutBetweenAttempts` перед следующей попыткой. */
  delayBetweenAttempts: () => Promise<void>;
  /** Колбэк `onBeforeRetry` перед повторной попыткой (после задержки). */
  onBeforeRetryRequest: () => Promise<void>;
  /** Достигнут ли лимит попыток подряд (`AttemptsState`). */
  hasLimitReached: () => boolean;
  /** Событие `before-attempt` наружу. */
  emitBeforeAttempt: () => void;
  /** Остановка ping, check-telephony, registration-failed подписок. */
  stopConnectTriggers: () => void;
  /** Пометить попытку как начатую (статус «в процессе»). */
  startAttempt: () => void;
  /** Увеличить счётчик попыток. */
  incrementAttempt: () => void;
  /** Завершить попытку (снять флаг «в процессе»). */
  finishAttempt: () => void;
  /** Событие `limit-reached-attempts`. */
  emitLimitReachedAttempts: () => void;
  /** Запуск периодической проверки телефонии после лимита. */
  startCheckTelephony: () => void;
  /** Успешный `connect`: подписки на мониторинг и `success`. */
  onConnectSucceeded: () => void;
  /** Ошибка без ретрая: `stop-attempts-by-error`. */
  onStopAttemptsByError: (error: unknown) => void;
  /** Отмена с передачей исходной ошибки (например «неактуальный» промис). */
  emitCancelledAttemptsRaw: (error: unknown) => void;
  /** Отмена с нормализацией ошибки в `Error` (цепочка задержки / beforeRetry). */
  emitCancelledAttemptsWrapped: (error: unknown) => void;
  /** Исчерпание попыток после ошибки в цепочке ретрая: `failed-all-attempts`. */
  onFailedAllAttempts: (error: unknown) => void;
  /** Уже подключены: остановить триггеры и `success` (ветка check-telephony). */
  onTelephonyStillConnected: () => void;
};
