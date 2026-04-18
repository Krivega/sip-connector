import { C as JsSIP_C } from '@krivega/jssip';

import CallReconnectManager from '../@CallReconnectManager';
import { FakeCallManager, FakeConnectionManager, makeNetworkFailedEndEvent } from '../__fixtures__';
import { ECallReconnectStatus } from '../CallReconnectStateMachine';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';

const makeRedialParameters = () => {
  return {
    getCallParameters: jest.fn(async () => {
      return { number: '100' } as never;
    }),
  };
};

const createSubject = (
  overrides: {
    callManager?: FakeCallManager;
    connectionManager?: FakeConnectionManager;
    startCall?: (...arguments_: unknown[]) => Promise<void>;
    options?: Partial<{
      baseBackoffMs: number;
      maxBackoffMs: number;
      backoffFactor: number;
      jitter: 'none' | 'equal' | 'full';
      maxAttempts: number;
      waitSignalingTimeoutMs: number;
    }>;
  } = {},
) => {
  const callManager = overrides.callManager ?? new FakeCallManager();
  const connectionManager = overrides.connectionManager ?? new FakeConnectionManager();

  if (overrides.startCall) {
    callManager.startCall = jest.fn(overrides.startCall) as FakeCallManager['startCall'];
  }

  const manager = new CallReconnectManager(
    {
      callManager: callManager as unknown as CallManager,
      connectionManager: connectionManager as unknown as ConnectionManager,
    },
    {
      baseBackoffMs: overrides.options?.baseBackoffMs ?? 1,
      maxBackoffMs: overrides.options?.maxBackoffMs ?? 2,
      backoffFactor: overrides.options?.backoffFactor ?? 1,
      jitter: overrides.options?.jitter ?? 'none',
      maxAttempts: overrides.options?.maxAttempts ?? 3,
      waitSignalingTimeoutMs: overrides.options?.waitSignalingTimeoutMs ?? 50,
    },
  );

  return { manager, callManager, connectionManager };
};

const waitFor = async <T>(
  manager: CallReconnectManager,
  event: Parameters<CallReconnectManager['on']>[0],
  timeoutMs = 1000,
): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timed out waiting for event "${String(event)}"`));
    }, timeoutMs);

    manager.on(event, (payload) => {
      clearTimeout(timeoutId);
      resolve(payload as T);
    });
  });
};

describe('CallReconnectManager (integration)', () => {
  describe('basic flow', () => {
    it('reconnects successfully after a network failure', async () => {
      const { manager, callManager } = createSubject();

      manager.arm(makeRedialParameters());

      const scheduled: unknown[] = [];

      manager.on('attempt-scheduled', (payload) => {
        scheduled.push(payload);
      });

      callManager.emit('failed', makeNetworkFailedEndEvent(JsSIP_C.causes.REQUEST_TIMEOUT));

      await waitFor(manager, 'attempt-succeeded');

      expect(callManager.startCall).toHaveBeenCalledTimes(1);
      expect(scheduled).toHaveLength(1);
      expect(manager.state).toBe(ECallReconnectStatus.ARMED);

      manager.stop();
    });

    it('disarms on non-network failures (BUSY/REJECTED/etc.)', () => {
      const { manager, callManager } = createSubject();
      const onFailureDetected = jest.fn();
      const onAttemptStarted = jest.fn();

      manager.on('failure-detected', onFailureDetected);
      manager.on('attempt-started', onAttemptStarted);

      manager.arm(makeRedialParameters());
      callManager.emit('failed', makeNetworkFailedEndEvent(JsSIP_C.causes.BUSY));

      expect(onFailureDetected).not.toHaveBeenCalled();
      expect(onAttemptStarted).not.toHaveBeenCalled();
      expect(callManager.startCall).not.toHaveBeenCalled();
      expect(manager.state).toBe(ECallReconnectStatus.IDLE);

      manager.stop();
    });

    it('retries after a transient failure until it succeeds', async () => {
      const callManager = new FakeCallManager();
      let attempts = 0;

      const { manager } = createSubject({
        callManager,
        startCall: async () => {
          attempts += 1;

          if (attempts < 2) {
            throw new Error('transient failure');
          }
        },
      });

      manager.arm(makeRedialParameters());
      callManager.emit('failed', makeNetworkFailedEndEvent(JsSIP_C.causes.REQUEST_TIMEOUT));

      await waitFor(manager, 'attempt-succeeded');

      expect(callManager.startCall).toHaveBeenCalledTimes(2);

      manager.stop();
    });
  });

  describe('signaling coordination', () => {
    it('waits for signaling to become ready before attempting', async () => {
      const connectionManager = new FakeConnectionManager();

      connectionManager.isRegistered = false;

      const { manager, callManager } = createSubject({
        connectionManager,
        options: { waitSignalingTimeoutMs: 1000 },
      });

      const waitingPromise = waitFor(manager, 'waiting-signaling');

      manager.arm(makeRedialParameters());
      callManager.emit('failed', makeNetworkFailedEndEvent(JsSIP_C.causes.REQUEST_TIMEOUT));

      await waitingPromise;

      expect(manager.state).toBe(ECallReconnectStatus.WAITING_SIGNALING);

      connectionManager.isRegistered = true;
      connectionManager.emit('registered');

      await waitFor(manager, 'attempt-succeeded');

      expect(callManager.startCall).toHaveBeenCalledTimes(1);

      manager.stop();
    });

    it('goes to WAITING_SIGNALING if connection drops during backoff', async () => {
      const connectionManager = new FakeConnectionManager();
      const { manager, callManager } = createSubject({
        connectionManager,
        options: {
          baseBackoffMs: 200,
          maxBackoffMs: 200,
          waitSignalingTimeoutMs: 1000,
        },
      });

      manager.arm(makeRedialParameters());
      callManager.emit('failed', makeNetworkFailedEndEvent(JsSIP_C.causes.REQUEST_TIMEOUT));

      const waitingPromise = waitFor(manager, 'waiting-signaling');

      connectionManager.isRegistered = false;
      connectionManager.emit('disconnected');

      await waitingPromise;

      expect(manager.state).toBe(ECallReconnectStatus.WAITING_SIGNALING);

      connectionManager.isRegistered = true;
      connectionManager.emit('connected');

      await waitFor(manager, 'attempt-succeeded');

      manager.stop();
    });

    it('goes to ERROR_TERMINAL when waitSignaling times out', async () => {
      const connectionManager = new FakeConnectionManager();

      connectionManager.isRegistered = false;

      const { manager, callManager } = createSubject({
        connectionManager,
        options: { waitSignalingTimeoutMs: 10 },
      });

      manager.arm(makeRedialParameters());
      callManager.emit('failed', makeNetworkFailedEndEvent(JsSIP_C.causes.REQUEST_TIMEOUT));

      await new Promise<void>((resolve) => {
        const check = () => {
          if (manager.state === ECallReconnectStatus.ERROR_TERMINAL) {
            resolve();
          } else {
            setTimeout(check, 5);
          }
        };

        check();
      });

      expect(manager.state).toBe(ECallReconnectStatus.ERROR_TERMINAL);

      manager.stop();
    });
  });

  describe('edge cases', () => {
    it('stops retrying and emits limit-reached when maxAttempts is exhausted', async () => {
      const callManager = new FakeCallManager();
      const { manager } = createSubject({
        callManager,
        startCall: async () => {
          throw new Error('always fails');
        },
        options: { maxAttempts: 2 },
      });

      const limitPromise = waitFor<{ attempts: number }>(manager, 'limit-reached');

      manager.arm(makeRedialParameters());
      callManager.emit('failed', makeNetworkFailedEndEvent(JsSIP_C.causes.REQUEST_TIMEOUT));

      const payload = await limitPromise;

      expect(payload.attempts).toBe(2);
      expect(manager.state).toBe(ECallReconnectStatus.LIMIT_REACHED);
      expect(callManager.startCall).toHaveBeenCalledTimes(2);

      manager.stop();
    });

    it('forceReconnect re-starts attempts even after LIMIT_REACHED', async () => {
      const callManager = new FakeCallManager();
      let shouldFail = true;

      const { manager } = createSubject({
        callManager,
        startCall: async () => {
          if (shouldFail) {
            throw new Error('forced fail');
          }
        },
        options: { maxAttempts: 1 },
      });

      manager.arm(makeRedialParameters());
      callManager.emit('failed', makeNetworkFailedEndEvent(JsSIP_C.causes.REQUEST_TIMEOUT));

      await waitFor(manager, 'limit-reached');

      shouldFail = false;

      const successPromise = waitFor(manager, 'attempt-succeeded');

      manager.forceReconnect();

      await successPromise;

      expect(callManager.startCall).toHaveBeenCalledTimes(2);

      manager.stop();
    });

    it('disarm cancels an in-flight attempt and emits cancelled', async () => {
      const callManager = new FakeCallManager();
      const inFlightResolvers: (() => void)[] = [];

      callManager.startCall = jest.fn(async () => {
        return new Promise<void>((resolve) => {
          inFlightResolvers.push(resolve);
        });
      }) as FakeCallManager['startCall'];

      const { manager } = createSubject({ callManager });
      const onCancelled = jest.fn();

      manager.on('cancelled', onCancelled);

      manager.arm(makeRedialParameters());
      callManager.emit('failed', makeNetworkFailedEndEvent(JsSIP_C.causes.REQUEST_TIMEOUT));

      await waitFor(manager, 'attempt-started');

      manager.disarm('manual');

      expect(manager.state).toBe(ECallReconnectStatus.IDLE);
      expect(onCancelled).toHaveBeenCalledWith({ reason: 'manual' });

      inFlightResolvers.forEach((resolve) => {
        resolve();
      });

      manager.stop();
    });

    it('spectator role prevents arming and emits cancelled("spectator-role")', () => {
      const callManager = new FakeCallManager();

      callManager.setSpectator(true);

      const { manager } = createSubject({ callManager });
      const onCancelled = jest.fn();
      const onArmed = jest.fn();

      manager.on('cancelled', onCancelled);
      manager.on('armed', onArmed);

      manager.arm(makeRedialParameters());

      expect(manager.state).toBe(ECallReconnectStatus.IDLE);
      expect(onCancelled).toHaveBeenCalledWith({ reason: 'spectator-role' });
      expect(onArmed).not.toHaveBeenCalled();

      manager.stop();
    });

    it('local end-call in ARMED (before failure) disarms the manager', () => {
      const { manager, callManager } = createSubject();

      manager.arm(makeRedialParameters());
      expect(manager.state).toBe(ECallReconnectStatus.ARMED);

      callManager.emit('end-call');

      expect(manager.state).toBe(ECallReconnectStatus.IDLE);

      manager.stop();
    });

    it('re-arming during a cycle cancels in-flight and resets attempts', async () => {
      const callManager = new FakeCallManager();
      let attempts = 0;

      callManager.startCall = jest.fn(async () => {
        attempts += 1;

        throw new Error('fail');
      }) as FakeCallManager['startCall'];

      const { manager } = createSubject({
        callManager,
        options: { maxAttempts: 5 },
      });

      manager.arm(makeRedialParameters());
      callManager.emit('failed', makeNetworkFailedEndEvent(JsSIP_C.causes.REQUEST_TIMEOUT));

      await waitFor(manager, 'attempt-failed');

      const firstWaveAttempts = attempts;

      manager.arm(makeRedialParameters());

      expect(manager.state).toBe(ECallReconnectStatus.ARMED);
      expect(firstWaveAttempts).toBeGreaterThan(0);

      manager.stop();
    });
  });
});
