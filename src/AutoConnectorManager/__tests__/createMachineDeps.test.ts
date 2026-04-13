import logger from '@/logger';
import { createMachineDeps } from '../createMachineDeps';

import type { TParametersAutoConnect } from '../types';

jest.mock('@/logger', () => {
  return jest.fn();
});

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
  return {
    canRetryOnError: jest.fn(() => {
      return true;
    }),
    stopConnectionFlow: jest.fn(async () => {}),
    connect: jest.fn(async () => {}),
    delayBetweenAttempts: jest.fn(async () => {}),
    onBeforeRetryRequest: jest.fn(async () => {}),
    hasLimitReached: jest.fn(() => {
      return false;
    }),
    emitBeforeAttempt: jest.fn(),
    stopConnectTriggers: jest.fn(),
    startAttempt: jest.fn(),
    incrementAttempt: jest.fn(),
    finishAttempt: jest.fn(),
    emitLimitReachedAttempts: jest.fn(),
    getParametersFromContext: jest.fn(() => {
      return createParameters();
    }),
    startCheckTelephony: jest.fn(),
    subscribeToConnectTriggers: jest.fn(),
    emitSuccess: jest.fn(),
    emitStopAttemptsByError: jest.fn(),
    emitCancelledAttempts: jest.fn(),
    emitFailedAllAttempts: jest.fn(),
  };
};

describe('createMachineDeps', () => {
  it('не запускает check-telephony, если параметры отсутствуют в контексте', () => {
    const params = createBaseParams();

    // @ts-expect-error
    params.getParametersFromContext.mockReturnValue(undefined);

    const deps = createMachineDeps(params);

    deps.startCheckTelephony();

    expect(params.startCheckTelephony).not.toHaveBeenCalled();
    expect(logger).toHaveBeenCalledWith(
      '[AutoConnectorManager] startCheckTelephony: context.parameters is undefined',
    );
  });

  it('не включает connect triggers, если параметры отсутствуют в контексте', () => {
    const params = createBaseParams();

    // @ts-expect-error
    params.getParametersFromContext.mockReturnValue(undefined);

    const deps = createMachineDeps(params);

    deps.onConnectSucceeded();

    expect(params.subscribeToConnectTriggers).not.toHaveBeenCalled();
    expect(params.emitSuccess).not.toHaveBeenCalled();
    expect(logger).toHaveBeenCalledWith(
      '[AutoConnectorManager] onConnectSucceeded: context.parameters is undefined',
    );
  });

  it('пробрасывает триггеры success при telephony still connected', () => {
    const params = createBaseParams();
    const deps = createMachineDeps(params);

    deps.onTelephonyStillConnected();

    expect(params.stopConnectTriggers).toHaveBeenCalledTimes(1);
    expect(params.emitSuccess).toHaveBeenCalledTimes(1);
  });

  it('заворачивает неизвестную ошибку в onFailedAllAttempts', () => {
    const params = createBaseParams();
    const deps = createMachineDeps(params);

    deps.onFailedAllAttempts('unexpected error');

    expect(params.emitFailedAllAttempts).toHaveBeenCalledWith(new Error('Failed to reconnect'));
  });
});
