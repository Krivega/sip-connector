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
      callManager: {} as never,
      emitters: {
        emitBeforeAttempt: jest.fn(),
        emitLimitReachedAttempts: jest.fn(),
        emitSuccess: jest.fn(),
        emitStopAttemptsByError: jest.fn(),
        emitCancelledAttempts: jest.fn(),
        emitFailedAllAttempts: jest.fn(),
        emitTelephonyCheckFailure: jest.fn(),
        emitTelephonyCheckEscalated: jest.fn(),
        emitStatusChange: jest.fn(),
      },
      reconnectActions: {
        requestReconnect: jest.fn(),
        requestFlowRestart: jest.fn(),
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
