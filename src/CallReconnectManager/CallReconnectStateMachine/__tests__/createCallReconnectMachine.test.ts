import { C as JsSIP_C } from '@krivega/jssip';
import { createActor } from 'xstate';

import { createCallReconnectMachine } from '../createCallReconnectMachine';
import { EState } from '../types';

import type { EndEvent } from '@krivega/jssip';
import type { TCallRedialParameters } from '../../types';
import type { TCallReconnectMachineDeps } from '../types';

const makeParameters = (): TCallRedialParameters => {
  return {
    getCallParameters: async () => {
      return {} as never;
    },
  };
};

const makeEndEvent = (
  overrides: Partial<{ cause: string; originator: 'local' | 'remote' | 'system' }> = {},
): EndEvent => {
  return {
    cause: JsSIP_C.causes.REQUEST_TIMEOUT,
    originator: 'remote',
    ...overrides,
  } as EndEvent;
};

const createDeps = (
  overrides: Partial<TCallReconnectMachineDeps> = {},
): TCallReconnectMachineDeps => {
  return {
    isNetworkFailure: () => {
      return true;
    },
    canRetryOnError: () => {
      return true;
    },
    isSignalingReady: () => {
      return true;
    },
    hasLimitReached: () => {
      return false;
    },
    computeNextDelayMs: () => {
      return 1;
    },
    delayBeforeAttempt: jest.fn(async () => {}),
    waitSignalingReady: jest.fn(async () => {}),
    performAttempt: jest.fn(async () => {}),
    registerAttemptStart: jest.fn(),
    registerAttemptFinish: jest.fn(),
    resetAttemptsState: jest.fn(),
    emitArmed: jest.fn(),
    emitDisarmed: jest.fn(),
    emitFailureDetected: jest.fn(),
    emitAttemptScheduled: jest.fn(),
    emitAttemptStarted: jest.fn(),
    emitAttemptSucceeded: jest.fn(),
    emitAttemptFailed: jest.fn(),
    emitWaitingSignaling: jest.fn(),
    emitLimitReached: jest.fn(),
    emitCancelled: jest.fn(),
    cancelAll: jest.fn(),
    getWaitSignalingTimeoutMs: () => {
      return 5000;
    },
    ...overrides,
  };
};

const settle = async () => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
};

describe('createCallReconnectMachine', () => {
  it('idle → armed by RECONNECT.ARM and emits armed event', () => {
    const deps = createDeps();
    const actor = createActor(createCallReconnectMachine(deps));

    actor.start();
    actor.send({ type: 'RECONNECT.ARM', parameters: makeParameters() });

    expect(actor.getSnapshot().value).toBe(EState.ARMED);
    expect(deps.emitArmed).toHaveBeenCalled();
    expect(deps.resetAttemptsState).toHaveBeenCalled();
  });

  it('armed → evaluating → backoff → attempting (happy path) then back to armed on success', async () => {
    const deps = createDeps({
      delayBeforeAttempt: jest.fn(async () => {}),
      performAttempt: jest.fn(async () => {}),
    });
    const actor = createActor(createCallReconnectMachine(deps));

    actor.start();
    actor.send({ type: 'RECONNECT.ARM', parameters: makeParameters() });
    actor.send({ type: 'CALL.FAILED', event: makeEndEvent() });

    await settle();

    expect(deps.performAttempt).toHaveBeenCalledTimes(1);
    expect(deps.registerAttemptStart).toHaveBeenCalledTimes(1);
    expect(deps.registerAttemptFinish).toHaveBeenCalled();
    expect(deps.emitAttemptSucceeded).toHaveBeenCalled();
    expect(actor.getSnapshot().value).toBe(EState.ARMED);
  });

  it('skips non-network failures (stays in armed)', () => {
    const deps = createDeps({
      isNetworkFailure: () => {
        return false;
      },
    });
    const actor = createActor(createCallReconnectMachine(deps));

    actor.start();
    actor.send({ type: 'RECONNECT.ARM', parameters: makeParameters() });
    actor.send({ type: 'CALL.FAILED', event: makeEndEvent({ originator: 'local' }) });

    expect(actor.getSnapshot().value).toBe(EState.ARMED);
    expect(deps.emitFailureDetected).not.toHaveBeenCalled();
  });

  it('routes to waitingSignaling when signaling not ready', async () => {
    const deps = createDeps({
      isSignalingReady: () => {
        return false;
      },
      waitSignalingReady: jest.fn(async () => {
        return new Promise<void>(() => {
          // hang — stay in waitingSignaling
        });
      }),
    });

    const actor = createActor(createCallReconnectMachine(deps));

    actor.start();
    actor.send({ type: 'RECONNECT.ARM', parameters: makeParameters() });
    actor.send({ type: 'CALL.FAILED', event: makeEndEvent() });

    await settle();

    expect(actor.getSnapshot().value).toBe(EState.WAITING_SIGNALING);
    expect(deps.emitWaitingSignaling).toHaveBeenCalled();
  });

  it('CONN.CONNECTED in waitingSignaling moves back to backoff', async () => {
    const deps = createDeps({
      isSignalingReady: () => {
        return false;
      },
      waitSignalingReady: jest.fn(async () => {
        return new Promise<void>(() => {});
      }),
      delayBeforeAttempt: jest.fn(async () => {
        return new Promise<void>(() => {});
      }),
    });
    const actor = createActor(createCallReconnectMachine(deps));

    actor.start();
    actor.send({ type: 'RECONNECT.ARM', parameters: makeParameters() });
    actor.send({ type: 'CALL.FAILED', event: makeEndEvent() });
    await settle();
    actor.send({ type: 'CONN.CONNECTED' });
    await settle();

    expect(actor.getSnapshot().value).toBe(EState.BACKOFF);
  });

  it('reaches limitReached when hasLimitReached=true on evaluation', () => {
    const deps = createDeps({
      hasLimitReached: () => {
        return true;
      },
    });
    const actor = createActor(createCallReconnectMachine(deps));

    actor.start();
    actor.send({ type: 'RECONNECT.ARM', parameters: makeParameters() });
    actor.send({ type: 'CALL.FAILED', event: makeEndEvent() });

    expect(actor.getSnapshot().value).toBe(EState.LIMIT_REACHED);
    expect(deps.emitLimitReached).toHaveBeenCalled();
  });

  it('RECONNECT.FORCE from limitReached re-enters evaluating and resets attempts', async () => {
    let limitReachedFlag = true;
    const deps = createDeps({
      hasLimitReached: () => {
        return limitReachedFlag;
      },
      delayBeforeAttempt: jest.fn(async () => {
        return new Promise<void>(() => {});
      }),
    });
    const actor = createActor(createCallReconnectMachine(deps));

    actor.start();
    actor.send({ type: 'RECONNECT.ARM', parameters: makeParameters() });
    actor.send({ type: 'CALL.FAILED', event: makeEndEvent() });
    expect(actor.getSnapshot().value).toBe(EState.LIMIT_REACHED);

    limitReachedFlag = false;
    actor.send({ type: 'RECONNECT.FORCE' });
    await settle();

    expect(deps.resetAttemptsState).toHaveBeenCalled();
    expect(actor.getSnapshot().value).toBe(EState.BACKOFF);
  });

  it('RECONNECT.DISARM from backoff cancels and goes to idle', async () => {
    const deps = createDeps({
      delayBeforeAttempt: jest.fn(async () => {
        return new Promise<void>(() => {});
      }),
    });
    const actor = createActor(createCallReconnectMachine(deps));

    actor.start();
    actor.send({ type: 'RECONNECT.ARM', parameters: makeParameters() });
    actor.send({ type: 'CALL.FAILED', event: makeEndEvent() });
    expect(actor.getSnapshot().value).toBe(EState.BACKOFF);

    actor.send({ type: 'RECONNECT.DISARM', reason: 'disarm' });
    await settle();

    expect(actor.getSnapshot().value).toBe(EState.IDLE);
    expect(deps.cancelAll).toHaveBeenCalled();
    expect(deps.emitDisarmed).toHaveBeenCalled();
    expect(deps.emitCancelled).toHaveBeenCalledWith({ reason: 'disarm' });
  });

  it('CALL.ENDED from armed goes to idle and emits disarmed (локальный hangUp)', async () => {
    const deps = createDeps();
    const actor = createActor(createCallReconnectMachine(deps));

    actor.start();
    actor.send({ type: 'RECONNECT.ARM', parameters: makeParameters() });
    actor.send({ type: 'CALL.ENDED' });
    await settle();

    expect(actor.getSnapshot().value).toBe(EState.IDLE);
    expect(deps.emitDisarmed).toHaveBeenCalled();
  });

  it('CALL.ENDED with event (remote BYE) из armed уводит в idle', async () => {
    const deps = createDeps();
    const actor = createActor(createCallReconnectMachine(deps));

    actor.start();
    actor.send({ type: 'RECONNECT.ARM', parameters: makeParameters() });
    actor.send({
      type: 'CALL.ENDED',
      event: { originator: 'remote', cause: 'BYE' } as never,
    });
    await settle();

    expect(actor.getSnapshot().value).toBe(EState.IDLE);
    expect(deps.emitDisarmed).toHaveBeenCalled();
  });

  it('attempt failed with canRetryOnError=false lands in errorTerminal', async () => {
    const performAttempt = jest.fn(async () => {
      throw new Error('no-retry');
    });
    const deps = createDeps({
      canRetryOnError: () => {
        return false;
      },
      performAttempt,
    });
    const actor = createActor(createCallReconnectMachine(deps));

    actor.start();
    actor.send({ type: 'RECONNECT.ARM', parameters: makeParameters() });
    actor.send({ type: 'CALL.FAILED', event: makeEndEvent() });
    await settle();

    expect(actor.getSnapshot().value).toBe(EState.ERROR_TERMINAL);
    expect(deps.emitAttemptFailed).toHaveBeenCalled();
  });

  it('attempt failed with retry policy re-enters evaluating → next backoff', async () => {
    let attempts = 0;
    const deps = createDeps({
      performAttempt: jest.fn(async () => {
        attempts += 1;

        if (attempts < 2) {
          throw new Error('transient');
        }
      }),
    });
    const actor = createActor(createCallReconnectMachine(deps));

    actor.start();
    actor.send({ type: 'RECONNECT.ARM', parameters: makeParameters() });
    actor.send({ type: 'CALL.FAILED', event: makeEndEvent() });
    await settle();
    await settle();

    expect(actor.getSnapshot().value).toBe(EState.ARMED);
    expect(deps.emitAttemptFailed).toHaveBeenCalledTimes(1);
    expect(deps.emitAttemptSucceeded).toHaveBeenCalledTimes(1);
  });
});
