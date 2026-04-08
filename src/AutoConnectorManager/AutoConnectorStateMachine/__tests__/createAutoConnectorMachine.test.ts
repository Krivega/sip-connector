import { createActor } from 'xstate';

import { createAutoConnectorMachine } from '../createAutoConnectorMachine';
import { AUTO_CONNECTOR_STATE_IDS } from '../types';

import type { TParametersAutoConnect } from '../../types';

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
    stopConnectionFlow: jest.fn(async () => {}),
    connect: jest.fn(async () => {}),
    delayBetweenAttempts: jest.fn(async () => {}),
    onBeforeRetryRequest: jest.fn(async () => {}),
    hasLimitReached: () => {
      return false;
    },
    emitBeforeAttempt: jest.fn(),
    stopConnectTriggers: jest.fn(),
    startAttempt: jest.fn(),
    incrementAttempt: jest.fn(),
    finishAttempt: jest.fn(),
    emitLimitReachedAttempts: jest.fn(),
    startCheckTelephony: jest.fn(),
    onConnectSucceeded: jest.fn(),
    onStopAttemptsByError: jest.fn(),
    emitCancelledAttemptsRaw: jest.fn(),
    emitCancelledAttemptsWrapped: jest.fn(),
    onFailedAllAttempts: jest.fn(),
    onTelephonyStillConnected: jest.fn(),
    ...overrides,
  };
};

describe('createAutoConnectorMachine', () => {
  it('после AUTO.RESTART из idle вызывает stopConnectionFlow и доходит до attemptingConnect', async () => {
    const deps = createDeps();
    const machine = createAutoConnectorMachine(deps);
    const actor = createActor(machine);

    actor.start();
    actor.send({ type: 'AUTO.RESTART', parameters });

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(deps.stopConnectionFlow).toHaveBeenCalled();
    expect(deps.emitBeforeAttempt).toHaveBeenCalled();
    expect(deps.connect).toHaveBeenCalled();
  });

  it('AUTO.STOP из idle остаётся в idle без ошибок', () => {
    const deps = createDeps();
    const machine = createAutoConnectorMachine(deps);
    const actor = createActor(machine);

    actor.start();
    actor.send({ type: 'AUTO.STOP' });

    expect(actor.getSnapshot().value).toBe(AUTO_CONNECTOR_STATE_IDS.IDLE);
    expect(deps.stopConnectionFlow).not.toHaveBeenCalled();
  });

  it('логирует ошибку при падении stopConnectionFlow', async () => {
    const deps = createDeps({
      stopConnectionFlow: jest.fn(async () => {
        throw new Error('stop failed');
      }),
    });
    const machine = createAutoConnectorMachine(deps);
    const actor = createActor(machine);

    actor.start();
    actor.send({ type: 'AUTO.RESTART', parameters });

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

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

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(deps.emitLimitReachedAttempts).toHaveBeenCalled();
    expect(deps.startCheckTelephony).toHaveBeenCalled();
  });
});
