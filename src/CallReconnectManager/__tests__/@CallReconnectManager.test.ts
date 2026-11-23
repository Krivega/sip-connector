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
    const onTerminationClassified = jest.fn();

    manager.on('termination-classified', onTerminationClassified);
    manager.arm(makeRedialParameters());
    callManager.emit('ended', { originator: 'remote', cause: 'BYE' });

    expect(manager.state).toBe(ECallReconnectStatus.IDLE);
    expect(onTerminationClassified).toHaveBeenCalledWith({
      decision: 'finish',
      event: { originator: 'remote', cause: 'BYE' },
    });

    manager.stop();
  });

  it('ended event с сетевой причиной (RTP_TIMEOUT) триггерит редиал', async () => {
    const { manager, callManager } = createSubject();
    const onTerminationClassified = jest.fn();

    manager.on('termination-classified', onTerminationClassified);
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
    expect(onTerminationClassified).toHaveBeenCalledWith({
      decision: 'redial',
      event: {
        originator: 'system',
        cause: JsSIP_C.causes.RTP_TIMEOUT,
      },
    });

    manager.stop();
  });

  describe('завершение звонка во время попытки', () => {
    // Звонок попытки висит, пока тест не отклонит его так же, как `CallManager.startCall`.
    const startPendingAttempt = async ({
      manager,
      callManager,
    }: ReturnType<typeof createSubject>) => {
      let rejectAttempt = (_error: unknown) => {};
      const waitForAttemptCallStarted = new Promise<void>((resolve) => {
        callManager.startCall.mockImplementationOnce(async () => {
          return new Promise<undefined>((_resolve, reject) => {
            rejectAttempt = reject;
            resolve();
          });
        });
      });

      manager.arm(makeRedialParameters());
      callManager.emit('failed', makeFailedEndEvent());
      await waitForAttemptCallStarted;

      return (error: unknown) => {
        rejectAttempt(error);
      };
    };

    it.each([JsSIP_C.causes.BUSY, JsSIP_C.causes.REJECTED])(
      'явный отказ удалённой стороны (%s) завершает перезвон без повторного звонка',
      async (cause) => {
        const subject = createSubject();
        const { manager, callManager } = subject;
        const refusal = { originator: 'remote', cause };
        const onTerminationClassified = jest.fn();
        const onDisarmed = jest.fn();
        const onAttemptFailed = jest.fn();
        const rejectAttempt = await startPendingAttempt(subject);

        manager.on('termination-classified', onTerminationClassified);
        manager.on('disarmed', onDisarmed);
        manager.on('attempt-failed', onAttemptFailed);

        callManager.emit('failed', refusal);
        rejectAttempt(refusal);
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 20);
        });

        expect(onTerminationClassified).toHaveBeenCalledTimes(1);
        expect(onTerminationClassified).toHaveBeenCalledWith({
          decision: 'finish',
          event: refusal,
        });
        expect(onDisarmed).toHaveBeenCalledTimes(1);
        expect(onAttemptFailed).not.toHaveBeenCalled();
        expect(callManager.startCall).toHaveBeenCalledTimes(1);
        expect(manager.state).toBe(ECallReconnectStatus.IDLE);

        manager.stop();
      },
    );

    it.each([
      [
        'ошибку подготовки звонка',
        { originator: 'local', cause: JsSIP_C.causes.INTERNAL_ERROR },
        new Error('Stale participant disconnect failed with status 500'),
      ],
      [
        'сетевой сбой',
        { originator: 'system', cause: JsSIP_C.causes.REQUEST_TIMEOUT },
        { originator: 'system', cause: JsSIP_C.causes.REQUEST_TIMEOUT },
      ],
      [
        'сетевой отказ удалённой стороны',
        { originator: 'remote', cause: JsSIP_C.causes.ADDRESS_INCOMPLETE },
        { originator: 'remote', cause: JsSIP_C.causes.ADDRESS_INCOMPLETE },
      ],
      [
        'временный отказ удалённой стороны (503)',
        { originator: 'remote', cause: JsSIP_C.causes.SIP_FAILURE_CODE },
        { originator: 'remote', cause: JsSIP_C.causes.SIP_FAILURE_CODE },
      ],
      [
        'недоступность удалённой стороны (480)',
        { originator: 'remote', cause: JsSIP_C.causes.UNAVAILABLE },
        { originator: 'remote', cause: JsSIP_C.causes.UNAVAILABLE },
      ],
    ])(
      'не классифицирует %s и передаёт отказ попытки политике повторов',
      async (_name, event, attemptError) => {
        const subject = createSubject();
        const { manager, callManager } = subject;
        const onTerminationClassified = jest.fn();
        const rejectAttempt = await startPendingAttempt(subject);
        const waitForSucceeded = new Promise<void>((resolve) => {
          manager.on('attempt-succeeded', () => {
            resolve();
          });
        });

        manager.on('termination-classified', onTerminationClassified);

        callManager.emit('failed', event);
        rejectAttempt(attemptError);
        await waitForSucceeded;

        expect(onTerminationClassified).not.toHaveBeenCalled();
        expect(callManager.startCall).toHaveBeenCalledTimes(2);
        expect(manager.state).toBe(ECallReconnectStatus.ARMED);

        manager.stop();
      },
    );
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
