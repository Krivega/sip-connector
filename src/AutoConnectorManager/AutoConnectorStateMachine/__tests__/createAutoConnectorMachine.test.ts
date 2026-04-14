import { assign, createActor } from 'xstate';

import { createNotReadyForConnectionError } from '@/ConnectionManager';
import { createAutoConnectorMachine } from '../createAutoConnectorMachine';
import { EState } from '../types';

import type { TParametersAutoConnect } from '../../types';

jest.mock('@/ConnectionQueueManager', () => {
  return {
    hasConnectionPromiseIsNotActualError: (error: unknown) => {
      return error instanceof Error && error.message === 'not actual promise';
    },
  };
});

jest.mock('@krivega/timeout-requester', () => {
  return {
    hasCanceledError: (error: unknown) => {
      return error instanceof Error && error.message === 'wait cancelled';
    },
  };
});

const parameters: TParametersAutoConnect = {
  getParameters: async () => {
    return {
      displayName: 'u',
      sipServerIp: 'sip:u',
      sipServerUrl: 'wss://u',
      register: false,
    };
  },
};

const createDeps = (overrides: Partial<Parameters<typeof createAutoConnectorMachine>[0]> = {}) => {
  return {
    canRetryOnError: () => {
      return true;
    },
    shouldDisconnectBeforeAttempt: () => {
      return false;
    },
    stopConnectionFlow: jest.fn(async () => {}),
    connect: jest.fn(async () => {}),
    delayBetweenAttempts: jest.fn(async () => {}),
    hasLimitReached: () => {
      return false;
    },
    beforeAttempt: jest.fn(),
    beforeConnectAttempt: jest.fn(),
    onLimitReached: jest.fn(),
    onConnectSucceeded: jest.fn(),
    emitTerminalOutcome: jest.fn(),
    onTelephonyStillConnected: jest.fn(),
    ...overrides,
  };
};

const settleMachine = async () => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
};

describe('createAutoConnectorMachine', () => {
  it('после AUTO.RESTART из idle на холодном старте сразу доходит до attemptingConnect', async () => {
    const deps = createDeps();
    const machine = createAutoConnectorMachine(deps);
    const actor = createActor(machine);

    actor.start();
    actor.send({ type: 'AUTO.RESTART', parameters });

    await settleMachine();

    expect(deps.stopConnectionFlow).not.toHaveBeenCalled();
    expect(deps.beforeAttempt).toHaveBeenCalled();
    expect(deps.connect).toHaveBeenCalled();
  });

  it('после AUTO.RESTART из idle вызывает stopConnectionFlow, если нужен предварительный disconnect', async () => {
    const deps = createDeps({
      shouldDisconnectBeforeAttempt: () => {
        return true;
      },
    });
    const machine = createAutoConnectorMachine(deps);
    const actor = createActor(machine);

    actor.start();
    actor.send({ type: 'AUTO.RESTART', parameters });

    await settleMachine();

    expect(deps.stopConnectionFlow).toHaveBeenCalled();
    expect(deps.connect).toHaveBeenCalled();
  });

  it('AUTO.STOP из idle остаётся в idle без ошибок', () => {
    const deps = createDeps();
    const machine = createAutoConnectorMachine(deps);
    const actor = createActor(machine);

    actor.start();
    actor.send({ type: 'AUTO.STOP' });

    expect(actor.getSnapshot().value).toBe(EState.IDLE);
    expect(deps.stopConnectionFlow).not.toHaveBeenCalled();
  });

  it('логирует ошибку при падении stopConnectionFlow', async () => {
    const deps = createDeps({
      shouldDisconnectBeforeAttempt: () => {
        return true;
      },
      stopConnectionFlow: jest.fn(async () => {
        throw new Error('stop failed');
      }),
    });
    const machine = createAutoConnectorMachine(deps);
    const actor = createActor(machine);

    actor.start();
    actor.send({ type: 'AUTO.RESTART', parameters });

    await settleMachine();

    expect(deps.stopConnectionFlow).toHaveBeenCalled();
  });

  it('при лимите попыток переходит к телефонии и вызывает onLimitReached цепочку', async () => {
    const deps = createDeps({
      hasLimitReached: () => {
        return true;
      },
    });
    const machine = createAutoConnectorMachine(deps);
    const actor = createActor(machine);

    actor.start();
    actor.send({ type: 'AUTO.RESTART', parameters });

    await settleMachine();

    expect(deps.onLimitReached).toHaveBeenCalledWith(parameters);
    expect(actor.getSnapshot().value).toBe(EState.TELEPHONY_CHECKING);
  });

  it('из telephonyChecking возвращается в connectedMonitoring без standby', async () => {
    const deps = createDeps({
      hasLimitReached: () => {
        return true;
      },
    });
    const machine = createAutoConnectorMachine(deps);
    const actor = createActor(machine);

    actor.start();
    actor.send({ type: 'AUTO.RESTART', parameters });

    await settleMachine();

    actor.send({ type: 'TELEPHONY.RESULT', outcome: 'stillConnected' });

    expect(actor.getSnapshot().value).toBe(EState.CONNECTED_MONITORING);
    expect(deps.onTelephonyStillConnected).toHaveBeenCalled();
  });

  it('неретраибельная ошибка переводит в errorTerminal с причиной halted', async () => {
    const error = createNotReadyForConnectionError();
    const deps = createDeps({
      connect: jest.fn(async () => {
        throw error;
      }),
    });
    const machine = createAutoConnectorMachine(deps);
    const actor = createActor(machine);

    actor.start();
    actor.send({ type: 'AUTO.RESTART', parameters });

    await settleMachine();

    expect(actor.getSnapshot().value).toBe(EState.ERROR_TERMINAL);
    expect(actor.getSnapshot().context.stopReason).toBe('halted');
    expect(deps.emitTerminalOutcome).toHaveBeenCalledWith({
      stopReason: 'halted',
      lastError: error,
    });
  });

  it('неактуальный promise переводит в errorTerminal с причиной cancelled', async () => {
    const error = new Error('not actual promise');
    const deps = createDeps({
      connect: jest.fn(async () => {
        throw error;
      }),
    });
    const machine = createAutoConnectorMachine(deps);
    const actor = createActor(machine);

    actor.start();
    actor.send({ type: 'AUTO.RESTART', parameters });

    await settleMachine();

    expect(actor.getSnapshot().value).toBe(EState.ERROR_TERMINAL);
    expect(actor.getSnapshot().context.stopReason).toBe('cancelled');
    expect(deps.emitTerminalOutcome).toHaveBeenCalledWith({
      stopReason: 'cancelled',
      lastError: error,
    });
  });

  it('отмена waitBeforeRetry переводит в errorTerminal с причиной cancelled', async () => {
    const error = new Error('wait cancelled');
    const deps = createDeps({
      connect: jest.fn(async () => {
        throw new Error('retryable');
      }),
      delayBetweenAttempts: jest.fn(async () => {
        throw error;
      }),
    });
    const machine = createAutoConnectorMachine(deps);
    const actor = createActor(machine);

    actor.start();
    actor.send({ type: 'AUTO.RESTART', parameters });

    await settleMachine();
    await settleMachine();

    expect(actor.getSnapshot().value).toBe(EState.ERROR_TERMINAL);
    expect(actor.getSnapshot().context.stopReason).toBe('cancelled');
    expect(deps.emitTerminalOutcome).toHaveBeenCalledWith({
      stopReason: 'cancelled',
      lastError: error,
    });
  });

  it('фатальная ошибка waitBeforeRetry переводит в errorTerminal с причиной failed', async () => {
    const error = new Error('wait failed');
    const deps = createDeps({
      connect: jest.fn(async () => {
        throw new Error('retryable');
      }),
      delayBetweenAttempts: jest.fn(async () => {
        throw error;
      }),
    });
    const machine = createAutoConnectorMachine(deps);
    const actor = createActor(machine);

    actor.start();
    actor.send({ type: 'AUTO.RESTART', parameters });

    await settleMachine();
    await settleMachine();

    expect(actor.getSnapshot().value).toBe(EState.ERROR_TERMINAL);
    expect(actor.getSnapshot().context.stopReason).toBe('failed');
    expect(deps.emitTerminalOutcome).toHaveBeenCalledWith({
      stopReason: 'failed',
      lastError: error,
    });
  });

  it('defensive branch: errorTerminal выдерживает вход без stopReason', async () => {
    const error = new Error('wait failed');
    const deps = createDeps({
      connect: jest.fn(async () => {
        throw new Error('retryable');
      }),
      delayBetweenAttempts: jest.fn(async () => {
        throw error;
      }),
    });
    const machine = createAutoConnectorMachine(deps).provide({
      actions: {
        assignWaitRetryFailedError: assign({
          stopReason: () => {
            return undefined;
          },
          lastError: () => {
            return error;
          },
        }),
      },
    });
    const actor = createActor(machine);

    actor.start();
    actor.send({ type: 'AUTO.RESTART', parameters });

    await settleMachine();
    await settleMachine();

    expect(actor.getSnapshot().value).toBe(EState.ERROR_TERMINAL);
    expect(actor.getSnapshot().context.stopReason).toBeUndefined();
    expect(deps.emitTerminalOutcome).toHaveBeenCalledWith({
      stopReason: undefined,
      lastError: error,
    });
  });

  it('переводит в errorTerminal, если параметры потеряны перед attemptingConnect', async () => {
    const deps = createDeps({
      canRetryOnError: () => {
        return false;
      },
    });
    const machine = createAutoConnectorMachine(deps).provide({
      actions: {
        assignRestart: assign({
          parameters: () => {
            return undefined;
          },
          afterDisconnect: () => {
            return 'attempt';
          },
          stopReason: () => {
            return undefined;
          },
          lastError: () => {
            return undefined;
          },
        }),
      },
    });
    const actor = createActor(machine);

    actor.start();
    actor.send({ type: 'AUTO.RESTART', parameters });

    await settleMachine();
    await settleMachine();

    expect(actor.getSnapshot().value).toBe(EState.ERROR_TERMINAL);
    expect(deps.emitTerminalOutcome).toHaveBeenCalled();

    const terminalError: unknown = actor.getSnapshot().context.lastError;

    expect(terminalError).toBeInstanceOf(Error);
    expect(terminalError).toEqual(
      expect.objectContaining({
        message: 'Auto connector parameters are missing in attemptingConnect state',
      }),
    );
  });
});
