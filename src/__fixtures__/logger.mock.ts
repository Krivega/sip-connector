/**
 * Полный набор экспортов, совместимый с `src/logger.ts` (default, enable/disable, resolveDebug, logError).
 * Используется в `src/__mocks__/logger.ts` и в `jest.mock('@/logger', () => createLoggerMockModule())`.
 */
import createJestMock from './createJestMock';

import type { TCompatibleMock } from './mockTypes';

export type LoggerMockModule = {
  __esModule: true;
  /** `resolveDebug`: при вызове возвращает вызываемую функцию (как `debug.extend`) */
  default: TCompatibleMock;
  enableDebug: TCompatibleMock;
  disableDebug: TCompatibleMock;
};

export function createLoggerMockModule(): LoggerMockModule {
  const mcuDebugLogger = createJestMock();
  const resolveDebugMock = createJestMock(() => {
    return mcuDebugLogger;
  });

  Object.assign(resolveDebugMock, {
    mcuDebugLogger,
  });

  return {
    __esModule: true,
    default: resolveDebugMock,
    enableDebug: createJestMock(),
    disableDebug: createJestMock(),
  };
}

/** Возвращает функцию, на которую пишет `resolveDebug('…')` (реальные вызовы логов). */
export function getMockedLoggerDefault(imported: unknown): TCompatibleMock {
  const resolveDebug = imported as TCompatibleMock & {
    mcuDebugLogger: TCompatibleMock;
  };

  return resolveDebug.mcuDebugLogger;
}
