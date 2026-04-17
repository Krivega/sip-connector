import { C as JsSIP_C } from '@krivega/jssip';

import { FakeConnectionManager } from '../__fixtures__';
import { CallReconnectRuntime } from '../CallReconnectRuntime';

import type { EndEvent } from '@krivega/jssip';
import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { TCallRedialParameters } from '../types';

const createCallManagerMock = () => {
  return {
    startCall: jest.fn(async () => {}),
  } as unknown as CallManager;
};

const createRuntime = (
  overrides: {
    callManager?: CallManager;
    connectionManager?: FakeConnectionManager;
    options?: ConstructorParameters<typeof CallReconnectRuntime>[0]['options'];
    emitStatusChange?: (payload: { isReconnecting: boolean }) => void;
  } = {},
) => {
  const connectionManager = overrides.connectionManager ?? new FakeConnectionManager();

  // По умолчанию в FakeConnectionManager стоит isRegistered=true — для рантайма хотим false,
  // чтобы проверять ветки ожидания сигнализации.
  if (overrides.connectionManager === undefined) {
    connectionManager.isRegistered = false;
  }

  const callManager = overrides.callManager ?? createCallManagerMock();
  const emitStatusChange = overrides.emitStatusChange ?? jest.fn();

  const runtime = new CallReconnectRuntime({
    callManager,
    connectionManager: connectionManager as unknown as ConnectionManager,
    options: overrides.options,
    emitters: { emitStatusChange },
  });

  return { runtime, connectionManager, callManager, emitStatusChange };
};

const makeRedialParameters = (): TCallRedialParameters => {
  return {
    getCallParameters: jest.fn(async () => {
      return { number: '100', mediaStream: new MediaStream() as unknown as MediaStream } as never;
    }),
  };
};

describe('CallReconnectRuntime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves options with defaults when none provided', () => {
    const { runtime } = createRuntime();

    expect(runtime.resolvedOptions.maxAttempts).toBe(5);
    expect(runtime.resolvedOptions.baseBackoffMs).toBe(1000);
    expect(runtime.resolvedOptions.maxBackoffMs).toBe(30_000);
    expect(runtime.resolvedOptions.backoffFactor).toBe(2);
    expect(runtime.resolvedOptions.jitter).toBe('equal');
    expect(runtime.resolvedOptions.waitSignalingTimeoutMs).toBe(20_000);
    expect(runtime.getWaitSignalingTimeoutMs()).toBe(20_000);
  });

  it('isNetworkFailure delegates to default policy when no override', () => {
    const { runtime } = createRuntime();

    expect(
      runtime.isNetworkFailure({
        cause: JsSIP_C.causes.REQUEST_TIMEOUT,
        originator: 'remote',
      } as unknown as EndEvent),
    ).toBe(true);
    expect(
      runtime.isNetworkFailure({
        cause: JsSIP_C.causes.BUSY,
        originator: 'remote',
      } as unknown as EndEvent),
    ).toBe(false);
  });

  it('isNetworkFailure uses injected predicate', () => {
    const predicate = jest.fn().mockReturnValue(true);
    const { runtime } = createRuntime({ options: { isNetworkFailure: predicate } });

    const event = { cause: JsSIP_C.causes.BUSY, originator: 'remote' } as unknown as EndEvent;

    expect(runtime.isNetworkFailure(event)).toBe(true);
    expect(predicate).toHaveBeenCalledWith(event);
  });

  it('canRetryOnError defaults to true and honors override', () => {
    const { runtime: defaultRuntime } = createRuntime();

    expect(defaultRuntime.canRetryOnError(new Error('boom'))).toBe(true);

    const { runtime: overridden } = createRuntime({
      options: {
        canRetryOnError: () => {
          return false;
        },
      },
    });

    expect(overridden.canRetryOnError(new Error('boom'))).toBe(false);
  });

  it('isSignalingReady reflects ConnectionManager.isRegistered', () => {
    const { runtime, connectionManager } = createRuntime();

    expect(runtime.isSignalingReady()).toBe(false);

    connectionManager.isRegistered = true;
    expect(runtime.isSignalingReady()).toBe(true);
  });

  it('hasLimitReached follows attempts state (maxAttempts=2)', () => {
    const { runtime } = createRuntime({ options: { maxAttempts: 2 } });

    expect(runtime.hasLimitReached()).toBe(false);
    runtime.registerAttemptStart();
    runtime.registerAttemptFinish();
    expect(runtime.hasLimitReached()).toBe(false);
    runtime.registerAttemptStart();
    runtime.registerAttemptFinish();
    expect(runtime.hasLimitReached()).toBe(true);

    runtime.resetAttemptsState();
    expect(runtime.hasLimitReached()).toBe(false);
  });

  it('computeNextDelayMs produces finite delay ≤ maxBackoffMs', () => {
    const { runtime } = createRuntime({
      options: { baseBackoffMs: 1000, maxBackoffMs: 2000, backoffFactor: 2, jitter: 'none' },
    });

    expect(runtime.computeNextDelayMs(1)).toBe(1000);
    expect(runtime.computeNextDelayMs(5)).toBe(2000);
  });

  it('registerAttempt{Start,Finish} notifies emitStatusChange with isReconnecting', () => {
    const emitStatusChange = jest.fn();
    const { runtime } = createRuntime({ emitStatusChange });

    runtime.registerAttemptStart();
    runtime.registerAttemptFinish();

    expect(emitStatusChange).toHaveBeenNthCalledWith(1, { isReconnecting: true });
    expect(emitStatusChange).toHaveBeenNthCalledWith(2, { isReconnecting: false });
  });

  it('waitSignalingReady resolves immediately when already registered', async () => {
    const connectionManager = new FakeConnectionManager();

    connectionManager.isRegistered = true;

    const { runtime } = createRuntime({ connectionManager });

    await expect(runtime.waitSignalingReady()).resolves.toBeUndefined();
    expect(connectionManager.handlers.connected.size).toBe(0);
  });

  it('waitSignalingReady resolves when connection manager emits "registered"', async () => {
    const connectionManager = new FakeConnectionManager();

    connectionManager.isRegistered = false;

    const { runtime } = createRuntime({ connectionManager });

    const promise = runtime.waitSignalingReady();

    expect(connectionManager.handlers.registered.size).toBe(1);
    connectionManager.emit('registered');

    await expect(promise).resolves.toBeUndefined();
    expect(connectionManager.handlers.registered.size).toBe(0);
  });

  it('waitSignalingReady rejects on timeout and cleans up listeners', async () => {
    const connectionManager = new FakeConnectionManager();

    connectionManager.isRegistered = false;

    const { runtime } = createRuntime({
      connectionManager,
      options: { waitSignalingTimeoutMs: 100 },
    });

    const promise = runtime.waitSignalingReady();

    jest.advanceTimersByTime(100);

    await expect(promise).rejects.toThrow('Wait signaling ready timeout');

    expect(connectionManager.handlers.connected.size).toBe(0);
    expect(connectionManager.handlers.registered.size).toBe(0);
  });

  it('cancelAll aborts pending waitSignalingReady subscription', () => {
    const connectionManager = new FakeConnectionManager();

    connectionManager.isRegistered = false;

    const { runtime } = createRuntime({ connectionManager });

    runtime.waitSignalingReady().catch(() => {
      // Ожидаемо: отмена через cancelAll, ошибка здесь не важна.
    });

    expect(connectionManager.handlers.registered.size).toBe(1);

    runtime.cancelAll();

    expect(connectionManager.handlers.registered.size).toBe(0);
  });

  it('performAttempt calls CallManager.startCall via resolved getCallParameters', async () => {
    const callManager = createCallManagerMock();
    const connectionManager = new FakeConnectionManager();
    const { runtime } = createRuntime({ callManager, connectionManager });

    const parameters = makeRedialParameters();

    await runtime.performAttempt(parameters);

    expect(parameters.getCallParameters).toHaveBeenCalledTimes(1);
    expect(callManager.startCall).toHaveBeenCalledTimes(1);
  });

  it('delayBeforeAttempt awaits requested delay', async () => {
    const { runtime } = createRuntime({ options: { baseBackoffMs: 10 } });

    const promise = runtime.delayBeforeAttempt(10);

    jest.advanceTimersByTime(10);
    await expect(promise).resolves.toBeUndefined();
  });
});
