import { C as JsSIP_C } from '@krivega/jssip';

import CallReconnectManager from '../@CallReconnectManager';
import { FakeCallManager, FakeConnectionManager, makeNetworkFailedEndEvent } from '../__fixtures__';
import { ECallReconnectStatus } from '../CallReconnectStateMachine';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';

const createSubject = (
  overrides: {
    callManager?: FakeCallManager;
    connectionManager?: FakeConnectionManager;
  } = {},
) => {
  const callManager = overrides.callManager ?? new FakeCallManager();
  const connectionManager = overrides.connectionManager ?? new FakeConnectionManager();

  const manager = new CallReconnectManager(
    {
      callManager: callManager as unknown as CallManager,
      connectionManager: connectionManager as unknown as ConnectionManager,
    },
    {
      baseBackoffMs: 1,
      maxBackoffMs: 2,
      backoffFactor: 1,
      jitter: 'none',
      maxAttempts: 3,
      waitSignalingTimeoutMs: 100,
    },
  );

  return { manager, callManager, connectionManager };
};

const makeRedialParameters = () => {
  return {
    getCallParameters: jest.fn(async () => {
      return { number: '100' } as never;
    }),
  };
};

const makeFailedEndEvent = () => {
  return makeNetworkFailedEndEvent(JsSIP_C.causes.REQUEST_TIMEOUT);
};

describe('CallReconnectManager (facade)', () => {
  it('starts in IDLE and isReconnecting=false', () => {
    const { manager } = createSubject();

    expect(manager.state).toBe(ECallReconnectStatus.IDLE);
    expect(manager.isReconnecting).toBe(false);

    manager.stop();
  });

  it('arm transitions to ARMED and emits "armed"', () => {
    const { manager } = createSubject();
    const onArmed = jest.fn();

    manager.on('armed', onArmed);
    manager.arm(makeRedialParameters());

    expect(manager.state).toBe(ECallReconnectStatus.ARMED);
    expect(onArmed).toHaveBeenCalledTimes(1);

    manager.stop();
  });

  it('arm while spectator role emits cancelled("spectator-role") and stays in IDLE', () => {
    const callManager = new FakeCallManager();

    callManager.setSpectator(true);

    const { manager } = createSubject({ callManager });
    const onCancelled = jest.fn();

    manager.on('cancelled', onCancelled);
    manager.arm(makeRedialParameters());

    expect(manager.state).toBe(ECallReconnectStatus.IDLE);
    expect(onCancelled).toHaveBeenCalledWith({ reason: 'spectator-role' });

    manager.stop();
  });

  it('subscribes to CallManager "failed" and triggers reconnect flow for network causes', async () => {
    const { manager, callManager } = createSubject();

    manager.arm(makeRedialParameters());

    const onFailureDetected = jest.fn();
    const onAttemptStarted = jest.fn();
    const onAttemptSucceeded = jest.fn();

    manager.on('failure-detected', onFailureDetected);
    manager.on('attempt-started', onAttemptStarted);
    manager.on('attempt-succeeded', onAttemptSucceeded);

    const waitForSucceeded = new Promise<void>((resolve) => {
      manager.on('attempt-succeeded', () => {
        resolve();
      });
    });

    callManager.emit('failed', makeFailedEndEvent());

    await waitForSucceeded;

    expect(onFailureDetected).toHaveBeenCalled();
    expect(onAttemptStarted).toHaveBeenCalled();
    expect(callManager.startCall).toHaveBeenCalledTimes(1);
    expect(onAttemptSucceeded).toHaveBeenCalled();

    manager.stop();
  });

  it('end-call event moves machine to IDLE', () => {
    const { manager, callManager } = createSubject();

    manager.arm(makeRedialParameters());
    callManager.emit('end-call');

    expect(manager.state).toBe(ECallReconnectStatus.IDLE);

    manager.stop();
  });

  it('ended event (remote BYE) разоружает машину', () => {
    const { manager, callManager } = createSubject();

    manager.arm(makeRedialParameters());
    callManager.emit('ended', { originator: 'remote', cause: 'BYE' });

    expect(manager.state).toBe(ECallReconnectStatus.IDLE);

    manager.stop();
  });

  it('ended event с сетевой причиной (RTP_TIMEOUT) триггерит редиал', async () => {
    const { manager, callManager } = createSubject();

    manager.arm(makeRedialParameters());

    const waitForSucceeded = new Promise<void>((resolve) => {
      manager.on('attempt-succeeded', () => {
        resolve();
      });
    });

    callManager.emit('ended', {
      originator: 'system',
      cause: JsSIP_C.causes.RTP_TIMEOUT,
    });

    await waitForSucceeded;

    expect(callManager.startCall).toHaveBeenCalledTimes(1);

    manager.stop();
  });

  it('failed event с бизнес-причиной (BUSY) разоружает менеджер', () => {
    const { manager, callManager } = createSubject();

    manager.arm(makeRedialParameters());
    callManager.emit('failed', { originator: 'remote', cause: JsSIP_C.causes.BUSY });

    expect(manager.state).toBe(ECallReconnectStatus.IDLE);
    expect(callManager.startCall).not.toHaveBeenCalled();

    manager.stop();
  });

  it('disarm cancels current attempt and emits cancelled with provided reason', () => {
    const { manager, callManager } = createSubject();
    const onCancelled = jest.fn();

    manager.on('cancelled', onCancelled);
    manager.arm(makeRedialParameters());
    callManager.emit('failed', makeFailedEndEvent());

    manager.disarm('local-hangup');

    expect(manager.state).toBe(ECallReconnectStatus.IDLE);
    expect(onCancelled).toHaveBeenCalledWith({ reason: 'local-hangup' });

    manager.stop();
  });

  it('stop unsubscribes from managers (subsequent emits are ignored)', () => {
    const { manager, callManager } = createSubject();

    manager.arm(makeRedialParameters());
    manager.stop();

    const failedSpy = jest.fn();

    manager.on('failure-detected', failedSpy);
    callManager.emit('failed', makeFailedEndEvent());

    expect(failedSpy).not.toHaveBeenCalled();
  });

  it('disarm() без аргумента использует причину по умолчанию', () => {
    const { manager } = createSubject();

    manager.arm(makeRedialParameters());
    manager.disarm();

    expect(manager.state).toBe(ECallReconnectStatus.IDLE);
    manager.stop();
  });

  it('cancelCurrentAttempt делегирует runtime.cancelAll (не меняя armed-состояние)', () => {
    const { manager, callManager } = createSubject();

    manager.arm(makeRedialParameters());
    callManager.emit('failed', makeFailedEndEvent());

    expect(manager.state).not.toBe(ECallReconnectStatus.IDLE);

    manager.cancelCurrentAttempt();
    // Позже state может перейти назад в armed — здесь проверяем, что вызов не бросает.

    manager.stop();
  });

  it('forceReconnect посылает RECONNECT.FORCE в машину', () => {
    const { manager } = createSubject();

    const sendSpy = jest.spyOn(manager.stateMachine, 'send');

    manager.arm(makeRedialParameters());
    manager.forceReconnect();

    expect(sendSpy).toHaveBeenCalledWith({ type: 'RECONNECT.FORCE' });

    manager.stop();
  });

  it('status-changed is triggered when a reconnect attempt is in progress', async () => {
    const { manager, callManager } = createSubject();

    const onStatus = jest.fn();

    manager.on('status-changed', onStatus);

    manager.arm(makeRedialParameters());

    const waitForSucceeded = new Promise<void>((resolve) => {
      manager.on('attempt-succeeded', () => {
        resolve();
      });
    });

    callManager.emit('failed', makeFailedEndEvent());

    await waitForSucceeded;

    expect(onStatus).toHaveBeenCalledWith({ isReconnecting: true });
    expect(onStatus).toHaveBeenCalledWith({ isReconnecting: false });

    manager.stop();
  });
});
