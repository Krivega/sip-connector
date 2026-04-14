/// <reference types="jest" />

import debug from 'debug';

import resolveDebug, { disableDebug, enableDebug } from '../logger';

type DebugMock = jest.Mock & {
  enable: jest.Mock;
  mockedControls: {
    enableDebug: jest.Mock;
    extend: jest.Mock;
    scopedLogger: jest.Mock;
  };
};

jest.mock('debug', () => {
  const scopedLogger = jest.fn();
  const mockExtend = jest.fn(() => {
    return scopedLogger;
  });
  const mockEnableDebug = jest.fn();

  const debugMocked = jest.fn(() => {
    return {
      extend: mockExtend,
    };
  });

  Object.assign(debugMocked, {
    enable: (arguments_: string) => {
      mockEnableDebug(arguments_);
    },
    mockedControls: {
      enableDebug: mockEnableDebug,
      extend: mockExtend,
      scopedLogger,
    },
  });

  return debugMocked;
});

const getDebugMock = () => {
  return debug as unknown as DebugMock;
};

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('должен включать и отключать отладку', () => {
    const debugMock = getDebugMock();

    enableDebug();

    expect(debugMock.mockedControls.enableDebug).toHaveBeenCalledTimes(1);
    expect(debugMock.mockedControls.enableDebug).toHaveBeenCalledWith('sip-connector:*');

    disableDebug();

    expect(debugMock.mockedControls.enableDebug).toHaveBeenCalledTimes(2);
    expect(debugMock.mockedControls.enableDebug).toHaveBeenCalledWith('-sip-connector:*');
  });

  it('должен возвращать logger с нужным namespace', () => {
    const debugMock = getDebugMock();
    const logger = resolveDebug('auto-connector');

    expect(debugMock.mockedControls.extend).toHaveBeenCalledTimes(1);
    expect(debugMock.mockedControls.extend).toHaveBeenCalledWith('auto-connector');
    expect(logger).toBe(debugMock.mockedControls.scopedLogger);
  });
});
