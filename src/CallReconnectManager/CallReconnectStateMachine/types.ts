import type { EndEvent } from '@krivega/jssip';
import type { TCallRedialParameters, TCancelledReason } from '../types';

export enum EState {
  IDLE = 'idle',
  ARMED = 'armed',
  EVALUATING = 'evaluating',
  BACKOFF = 'backoff',
  WAITING_SIGNALING = 'waitingSignaling',
  ATTEMPTING = 'attempting',
  LIMIT_REACHED = 'limitReached',
  ERROR_TERMINAL = 'errorTerminal',
}

/** Общий контекст машины. Описываем инварианты по состояниям через `TContextMap`. */
type TBaseContext = {
  parameters: TCallRedialParameters | undefined;
  attempt: number;
  nextDelayMs: number;
  lastError: unknown;
  lastFailureCause: string | undefined;
  cancelledReason: TCancelledReason | undefined;
};

export type TContextMap = {
  [EState.IDLE]: TBaseContext & {
    parameters: undefined;
  };
  [EState.ARMED]: TBaseContext & {
    parameters: TCallRedialParameters;
  };
  [EState.EVALUATING]: TBaseContext & {
    parameters: TCallRedialParameters;
  };
  [EState.BACKOFF]: TBaseContext & {
    parameters: TCallRedialParameters;
  };
  [EState.WAITING_SIGNALING]: TBaseContext & {
    parameters: TCallRedialParameters;
  };
  [EState.ATTEMPTING]: TBaseContext & {
    parameters: TCallRedialParameters;
  };
  [EState.LIMIT_REACHED]: TBaseContext & {
    parameters: TCallRedialParameters;
  };
  [EState.ERROR_TERMINAL]: TBaseContext;
};

export type TContext = TContextMap[keyof TContextMap];

export type TCallReconnectEvent =
  | { type: 'RECONNECT.ARM'; parameters: TCallRedialParameters }
  | { type: 'RECONNECT.DISARM'; reason?: TCancelledReason }
  | { type: 'RECONNECT.FORCE' }
  | { type: 'CALL.FAILED'; event: EndEvent }
  | { type: 'CALL.ENDED_LOCAL' }
  | { type: 'CONN.CONNECTED' }
  | { type: 'CONN.DISCONNECTED' };

/**
 * Зависимости машины: асинхронные шаги и чистые guards/actions.
 *
 * Ассортимент намеренно узкий — всю работу с сайд-эффектами делает `CallReconnectRuntime`,
 * а машина только декларирует переходы и эмитит события фасаду.
 */
export type TCallReconnectMachineDeps = {
  /** Политика «это сетевой сбой?». */
  isNetworkFailure: (event: EndEvent) => boolean;
  /** Политика «эту ошибку `startCall` ретраим?». */
  canRetryOnError: (error: unknown) => boolean;
  /** Готова ли сигнализация к следующей попытке (зарегистрирован ли UA). */
  isSignalingReady: () => boolean;
  /** Лимит попыток достигнут? */
  hasLimitReached: () => boolean;
  /** Рассчитать следующую задержку (чистый `BackoffPolicy`), номер попытки передаётся извне. */
  computeNextDelayMs: (attempt: number) => number;
  /** Промис задержки перед попыткой. Отменяется через `DelayRequester`. */
  delayBeforeAttempt: (nextDelayMs: number) => Promise<void>;
  /** Ожидание сигнала готовности сигнализации с таймаутом. */
  waitSignalingReady: () => Promise<void>;
  /** Перфоманс одной попытки `startCall` с актуальными параметрами. */
  performAttempt: (parameters: TCallRedialParameters) => Promise<void>;
  /** Инкремент попыток + `isInProgress=true`. */
  registerAttemptStart: () => void;
  /** Завершение попытки (успех/провал) — `isInProgress=false`. */
  registerAttemptFinish: () => void;
  /** Сброс состояния попыток при `arm`/`force`/`disarm`. */
  resetAttemptsState: () => void;
  /** Эмит `armed`. */
  emitArmed: () => void;
  /** Эмит `disarmed`. */
  emitDisarmed: () => void;
  /** Эмит `failure-detected`. */
  emitFailureDetected: (payload: { cause: string; originator: string; attempt: number }) => void;
  /** Эмит `attempt-scheduled`. */
  emitAttemptScheduled: (payload: { attempt: number; delayMs: number }) => void;
  /** Эмит `attempt-started`. */
  emitAttemptStarted: (payload: { attempt: number }) => void;
  /** Эмит `attempt-succeeded`. */
  emitAttemptSucceeded: (payload: { attempt: number }) => void;
  /** Эмит `attempt-failed`. */
  emitAttemptFailed: (payload: { attempt: number; error: unknown }) => void;
  /** Эмит `waiting-signaling`. */
  emitWaitingSignaling: (payload: { timeoutMs: number }) => void;
  /** Эмит `limit-reached`. */
  emitLimitReached: (payload: { attempts: number }) => void;
  /** Эмит `cancelled`. */
  emitCancelled: (payload: { reason: TCancelledReason }) => void;
  /** Cancel all side-effects (delay + in-flight call). */
  cancelAll: () => void;
  /** Возвращает текущее значение `waitSignalingTimeoutMs` (для events). */
  getWaitSignalingTimeoutMs: () => number;
};
