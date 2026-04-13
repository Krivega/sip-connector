import logger from '@/logger';
import { AutoConnectorRuntime } from '../AutoConnectorRuntime';

jest.mock('@/logger', () => {
  return jest.fn();
});

describe('AutoConnectorRuntime', () => {
  it('логирует defensive-ветку, если terminal outcome пришел без stopReason', () => {
    const runtime = new AutoConnectorRuntime({
      connectionManager: {} as never,
      connectionQueueManager: {} as never,
      checkTelephonyRequester: {} as never,
      pingServerIfNotActiveCallRequester: {} as never,
      registrationFailedOutOfCallSubscriber: {} as never,
      attemptsState: {
        finishAttempt: jest.fn(),
      } as never,
      delayBetweenAttempts: {} as never,
      telephonyFailPolicy: {} as never,
      networkInterfacesSubscriber: undefined,
      resumeFromSleepModeSubscriber: undefined,
      emitters: {
        emitBeforeAttempt: jest.fn(),
        emitLimitReachedAttempts: jest.fn(),
        emitSuccess: jest.fn(),
        emitStopAttemptsByError: jest.fn(),
        emitCancelledAttempts: jest.fn(),
        emitFailedAllAttempts: jest.fn(),
        emitTelephonyCheckFailure: jest.fn(),
        emitTelephonyCheckEscalated: jest.fn(),
      },
      reconnectActions: {
        requestReconnect: jest.fn(),
        requestFlowRestart: jest.fn(),
        requestStop: jest.fn(),
        notifyTelephonyStillConnected: jest.fn(),
      },
    });

    runtime.emitTerminalOutcome({
      stopReason: undefined,
      lastError: new Error('unexpected'),
    });

    expect(logger).toHaveBeenCalledWith(
      'emitTerminalOutcome without stopReason',
      expect.any(Error),
    );
  });
});
