import type { EndEvent } from '@krivega/jssip';
import type { CallManager } from '@/CallManager';

/**
 * Параметры, которые `CallReconnectManager` использует для повторного вызова `call`.
 *
 * Контракт: функция `getCallParameters` перечитывает актуальные параметры перед каждой попыткой —
 * это важно для токенов/аутентификационных заголовков, которые могут быть ротированы.
 */
export type TCallRedialParameters = {
  getCallParameters: () => Promise<
    Omit<Parameters<CallManager['startCall']>[2], 'isPresentationCall'>
  >;
};

/**
 * Политика определения «это сетевой сбой?» по событию `failed` от `CallManager`.
 *
 * Реализуется как Strategy: можно заменить дефолтный matcher для специфических развёртываний.
 */
export type TIsNetworkFailure = (event: EndEvent) => boolean;

/**
 * Режимы jitter для `BackoffPolicy`.
 *
 * - `none`    — детерминированное `baseBackoffMs * factor ^ (attempt - 1)`;
 * - `equal`   — половина детерминированного + половина случайной (смазываем всплески);
 * - `full`    — полностью случайное значение в `[0, detDelay]` (максимально размазывает пики).
 */
export type TBackoffJitter = 'none' | 'equal' | 'full';

export interface ICallReconnectOptions {
  /** Максимальное число попыток до перехода в `limitReached`. Значение `0` — бесконечно. */
  maxAttempts?: number;
  /** Базовая задержка первой попытки (в мс). */
  baseBackoffMs?: number;
  /** Верхняя граница задержки (в мс). */
  maxBackoffMs?: number;
  /** Множитель роста задержки. */
  backoffFactor?: number;
  /** Режим рандомизации задержки (см. `TBackoffJitter`). */
  jitter?: TBackoffJitter;
  /** Таймаут ожидания восстановления сигнализации перед попыткой (в мс). */
  waitSignalingTimeoutMs?: number;
  /** Кастомный predicate сетевой ошибки. По умолчанию — набор из `JsSIP_C.causes`. */
  isNetworkFailure?: TIsNetworkFailure;
  /** Кастомный predicate повторяемости ошибки `startCall`. По умолчанию — всегда retryable. */
  canRetryOnError?: (error: unknown) => boolean;
}

export interface ICallReconnectOptionsResolved {
  maxAttempts: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  backoffFactor: number;
  jitter: TBackoffJitter;
  waitSignalingTimeoutMs: number;
}

/** Причины, по которым менеджер инициирует событие `cancelled`. */
export type TCancelledReason = 'disarm' | 'manual' | 'local-hangup' | 'spectator-role';
