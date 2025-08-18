/// <reference types="jest" />
import { disableDebug, enableDebug } from '../index';

const mockEnableDebug = jest.fn();

jest.mock('debug', () => {
  const debugMocked = jest.fn();

  // @ts-expect-error
  debugMocked.enable = (arguments_: string) => {
    mockEnableDebug(arguments_);
  };

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
});
