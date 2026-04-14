import { createLoggerMockModule } from '@/__fixtures__/logger.mock';
import resolveDebug from '@/logger';
import { AutoConnectorRuntime } from '../AutoConnectorRuntime';

jest.mock('@/logger', () => {
  return createLoggerMockModule();
});

const autoConnectorRuntimeDebug = (resolveDebug as jest.Mock).mock.results[0].value as jest.Mock;

describe('AutoConnectorRuntime', () => {
  const createRuntime = ({
    isDisconnected = true,
    isIdle = false,
    isDisconnecting = false,
    requested = false,
  }: {
    isDisconnected?: boolean;
    isIdle?: boolean;
    isDisconnecting?: boolean;
    requested?: boolean;
  } = {}) => {
    return new AutoConnectorRuntime({
      connectionManager: {
        isDisconnected,
        isIdle,
        isDisconnecting,
        requested,
      } as never,
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
  };

  it('логирует defensive-ветку, если terminal outcome пришел без stopReason', () => {
    const runtime = createRuntime();

    runtime.emitTerminalOutcome({
      stopReason: undefined,
      lastError: new Error('unexpected'),
    });

    expect(autoConnectorRuntimeDebug).toHaveBeenCalledWith(
      'emitTerminalOutcome without stopReason',
      expect.any(Error),
    );
  });

  it('shouldDisconnectBeforeAttempt возвращает true, когда connection manager в disconnecting', () => {
    const runtime = createRuntime({
      isDisconnected: false,
      isDisconnecting: true,
    });

    expect(runtime.shouldDisconnectBeforeAttempt()).toBe(true);
  });

  it('shouldDisconnectBeforeAttempt возвращает true, когда есть requested', () => {
    const runtime = createRuntime({
      isDisconnected: false,
      requested: true,
    });

    expect(runtime.shouldDisconnectBeforeAttempt()).toBe(true);
  });
});
