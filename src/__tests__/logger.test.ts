/// <reference types="jest" />

import debug from 'debug';

import { disableDebug, enableDebug, logError } from '../logger';

const mockEnableDebug = jest.fn();

jest.mock('debug', () => {
  const loggerSpy = jest.fn();

  const debugMocked = jest.fn(() => {
    return loggerSpy;
  });

  // @ts-expect-error
  debugMocked.enable = (arguments_: string) => {
    mockEnableDebug(arguments_);
  };

  // Экспортируем spy через свойство мока, чтобы получить его в тесте
  // @ts-expect-error
  debugMocked.loggerSpy = loggerSpy;

  return debugMocked;
});

describe('Logger', () => {
  it('должен включать и отключать отладку', () => {
    enableDebug();

    expect(mockEnableDebug).toHaveBeenCalledTimes(1);
    expect(mockEnableDebug).toHaveBeenCalledWith('sip-connector');

    disableDebug();

    expect(mockEnableDebug).toHaveBeenCalledTimes(2);
    expect(mockEnableDebug).toHaveBeenCalledWith('-sip-connector');
  });

  it('logError: должен логировать ошибку', () => {
    logError('test-error', new Error('test-error'));

    const debugMocked = debug as unknown as jest.Mock & {
      loggerSpy: jest.Mock;
    };

    expect(debugMocked.loggerSpy).toHaveBeenCalledTimes(1);
    expect(debugMocked.loggerSpy).toHaveBeenCalledWith('test-error:', expect.any(Error));
  });
});
