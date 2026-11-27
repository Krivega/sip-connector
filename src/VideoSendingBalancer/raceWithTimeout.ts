import { cancelableDelayPromise } from '@krivega/timeout-requester';

/**
 * Гонка промисов с таймаутом: исход первого завершившегося, а если за timeoutMs не завершился ни один — результат onTimeout.
 * Отказ промиса, завершившегося первым, пробрасывается. Таймер снимается в любом случае
 * @param promises - Промисы гонки
 * @param timeoutMs - Таймаут в миллисекундах
 * @param onTimeout - Результат гонки по таймауту
 * @returns Promise с исходом гонки
 */
export const raceWithTimeout = async <T>(
  promises: readonly Promise<T>[],
  timeoutMs: number,
  onTimeout: () => T,
): Promise<T> => {
  const timeout = cancelableDelayPromise(timeoutMs);

  try {
    // производный от таймера промис живёт только в гонке: cancel() отклоняет его, и отказ обрабатывает гонка
    return await Promise.race([...promises, timeout.then(onTimeout)]);
  } finally {
    timeout.cancel();
  }
};
