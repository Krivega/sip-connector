import type { TBackoffJitter } from '../types';

type TBackoffParameters = {
  baseBackoffMs: number;
  maxBackoffMs: number;
  backoffFactor: number;
  jitter: TBackoffJitter;
};

const MIN_ATTEMPT = 1;

const clampAttempt = (attempt: number): number => {
  return attempt < MIN_ATTEMPT ? MIN_ATTEMPT : attempt;
};

/**
 * Детерминированная часть backoff: `base * factor ^ (attempt - 1)` с верхней границей `maxBackoffMs`.
 *
 * Это чистая функция без таймеров; таймер держит `DelayRequester` в runtime.
 */
const computeDeterministicDelay = (attempt: number, parameters: TBackoffParameters): number => {
  const { baseBackoffMs, maxBackoffMs, backoffFactor } = parameters;
  const normalizedAttempt = clampAttempt(attempt);

  const exponentialDelay = baseBackoffMs * backoffFactor ** (normalizedAttempt - 1);

  return Math.min(maxBackoffMs, exponentialDelay);
};

const applyJitter = (
  deterministicDelay: number,
  jitter: TBackoffJitter,
  random: () => number,
): number => {
  if (jitter === 'none') {
    return deterministicDelay;
  }

  if (jitter === 'full') {
    return random() * deterministicDelay;
  }

  const half = deterministicDelay / 2;

  return half + random() * half;
};

/**
 * Рассчитывает задержку перед следующей попыткой для заданного номера попытки.
 *
 * @param attempt — номер попытки, начиная с 1 (значения < 1 приводятся к 1).
 * @param parameters — параметры backoff.
 * @param random — источник псевдослучайности (по умолчанию `Math.random`), позволяет
 *                 детерминистично тестировать jitter-ветки.
 */
export const computeBackoffDelay = (
  attempt: number,
  parameters: TBackoffParameters,
  random: () => number = Math.random,
): number => {
  const deterministicDelay = computeDeterministicDelay(attempt, parameters);

  return applyJitter(deterministicDelay, parameters.jitter, random);
};
