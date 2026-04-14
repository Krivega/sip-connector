/**
 * Полный набор экспортов, совместимый с `src/logger.ts` (default, enable/disable, resolveDebug, logError).
 * Используется в `src/__mocks__/logger.ts` и в `jest.mock('@/logger', () => createLoggerMockModule())`.
 */
export type LoggerMockModule = {
  __esModule: true;
  /** `resolveDebug`: при вызове возвращает вызываемую функцию (как `debug.extend`) */
  default: jest.Mock;
  enableDebug: jest.Mock;
  disableDebug: jest.Mock;
};

export function createLoggerMockModule(): LoggerMockModule {
  const mcuDebugLogger = jest.fn();
  const resolveDebugMock = jest.fn(() => {
    return mcuDebugLogger;
  });

  Object.assign(resolveDebugMock, {
    mcuDebugLogger,
  });

  return {
    __esModule: true,
    default: resolveDebugMock,
    enableDebug: jest.fn(),
    disableDebug: jest.fn(),
  };
}

/** Возвращает функцию, на которую пишет `resolveDebug('…')` (реальные вызовы логов). */
export function getMockedLoggerDefault(imported: unknown): jest.Mock {
  const resolveDebug = imported as jest.Mock & { mcuDebugLogger: jest.Mock };

  return resolveDebug.mcuDebugLogger;
}
