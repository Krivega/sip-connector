import { createMachineDeps } from '../createMachineDeps';

import type { AutoConnectorRuntime } from '../AutoConnectorRuntime';
import type { TParametersAutoConnect } from '../types';

const createParameters = (): TParametersAutoConnect => {
  return {
    getParameters: async () => {
      return {
        displayName: 'u',
        sipServerIp: 'sip:u',
        sipServerUrl: 'wss://u',
        register: false,
      };
    },
  };
};

const createBaseParams = () => {
  const runtime = {
    shouldDisconnectBeforeAttempt: jest.fn(() => {
      return false;
    }),
    stopConnectionFlow: jest.fn(async () => {}),
    connect: jest.fn(async () => {}),
    delayBeforeRetry: jest.fn(async () => {}),
    hasLimitReached: jest.fn(() => {
      return false;
    }),
    beforeAttempt: jest.fn(),
    beforeConnectAttempt: jest.fn(),
    onLimitReached: jest.fn(),
    onConnectSucceeded: jest.fn(),
    emitTerminalOutcome: jest.fn(),
    onTelephonyStillConnected: jest.fn(),
  };

  return {
    runtime: runtime as unknown as AutoConnectorRuntime,
    canRetryOnError: jest.fn(() => {
      return true;
    }),
  };
};

describe('createMachineDeps', () => {
  it('прокидывает onLimitReached в runtime с параметрами', () => {
    const params = createBaseParams();
    const deps = createMachineDeps(params);
    const machineParameters = createParameters();

    deps.onLimitReached(machineParameters);

    expect(params.runtime.onLimitReached).toHaveBeenCalledWith(machineParameters);
  });

  it('прокидывает onConnectSucceeded в runtime с параметрами', () => {
    const params = createBaseParams();
    const deps = createMachineDeps(params);
    const machineParameters = createParameters();

    deps.onConnectSucceeded(machineParameters);

    expect(params.runtime.onConnectSucceeded).toHaveBeenCalledWith(machineParameters);
  });

  it('пробрасывает telephony still connected в runtime', () => {
    const params = createBaseParams();
    const deps = createMachineDeps(params);

    deps.onTelephonyStillConnected();

    expect(params.runtime.onTelephonyStillConnected).toHaveBeenCalledTimes(1);
  });

  it('в cancelled ветке нормализует неизвестную ошибку', () => {
    const params = createBaseParams();
    const deps = createMachineDeps(params);

    deps.emitTerminalOutcome({
      stopReason: 'cancelled',
      lastError: 'unexpected error',
    });

    expect(params.runtime.emitTerminalOutcome).toHaveBeenCalledWith({
      stopReason: 'cancelled',
      lastError: new Error('Failed to reconnect'),
    });
  });

  it('в cancelled ветке оставляет not-actual error без обертки', () => {
    const params = createBaseParams();
    const deps = createMachineDeps(params);
    const notActualError = new Error('Connection promise is not actual');

    deps.emitTerminalOutcome({
      stopReason: 'cancelled',
      lastError: notActualError,
    });

    expect(params.runtime.emitTerminalOutcome).toHaveBeenCalledWith({
      stopReason: 'cancelled',
      lastError: notActualError,
    });
  });

  it('в failed ветке нормализует ошибку в Error', () => {
    const params = createBaseParams();
    const deps = createMachineDeps(params);

    deps.emitTerminalOutcome({
      stopReason: 'failed',
      lastError: 'unexpected error',
    });

    expect(params.runtime.emitTerminalOutcome).toHaveBeenCalledWith({
      stopReason: 'failed',
      lastError: new Error('Failed to reconnect'),
    });
  });
});
