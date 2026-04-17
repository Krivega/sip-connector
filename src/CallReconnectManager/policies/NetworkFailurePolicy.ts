import { C as JsSIP_C } from '@krivega/jssip';

import type { EndEvent } from '@krivega/jssip';
import type { TIsNetworkFailure } from '../types';

/**
 * Набор `cause`, которые безусловно трактуем как транспортные/сетевые.
 *
 * В эту категорию попадают причины, связанные с потерей транспорта, таймаутами RTP/запросов
 * и недоступностью адреса. Остальные причины (BUSY, REJECTED, BYE и т.п.) — бизнес/пользовательские
 * и не должны автоматически триггерить редиал.
 */
const NETWORK_CAUSES = new Set<string>([
  JsSIP_C.causes.CONNECTION_ERROR,
  JsSIP_C.causes.REQUEST_TIMEOUT,
  JsSIP_C.causes.RTP_TIMEOUT,
  JsSIP_C.causes.ADDRESS_INCOMPLETE,
]);

/**
 * Дефолтный predicate сетевого сбоя.
 *
 * Правила:
 * - локальный hang-up (`originator === 'local'`) — это всегда НЕ сетевой сбой;
 * - причины из `NETWORK_CAUSES` — сетевой сбой;
 * - `INTERNAL_ERROR` с `originator === 'system'` — сетевой сбой (срезаем внутренние обрывы стэка),
 *   при `originator === 'remote'` это бизнес-ошибка и НЕ триггерит редиал.
 */
export const defaultIsNetworkFailure: TIsNetworkFailure = (event: EndEvent): boolean => {
  const { cause, originator } = event;

  if (originator === 'local') {
    return false;
  }

  if (NETWORK_CAUSES.has(cause)) {
    return true;
  }

  if (cause === JsSIP_C.causes.INTERNAL_ERROR && originator === 'system') {
    return true;
  }

  return false;
};

/**
 * Фабрика политики: пропускает пользовательский `predicate`, иначе возвращает дефолт.
 */
export const createNetworkFailurePolicy = (
  predicate: TIsNetworkFailure | undefined,
): TIsNetworkFailure => {
  return predicate ?? defaultIsNetworkFailure;
};
