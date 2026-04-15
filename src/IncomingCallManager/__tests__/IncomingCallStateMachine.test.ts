import { createLoggerMockModule } from '@/__fixtures__/logger.mock';
import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import { createEvents as createConnectionEvents } from '@/ConnectionManager';
import resolveDebug from '@/logger';
import { createEvents as createIncomingEvents } from '../events';
import { IncomingCallStateMachine, EIncomingStatus } from '../IncomingCallStateMachine';

import type { Socket } from '@krivega/jssip';
import type { TConnectionManagerEvents } from '@/ConnectionManager';
import type { TEvents as TIncomingEvents, TRemoteCallerData } from '../events';

type TIncomingCallStateMachineForTests = Omit<IncomingCallStateMachine, 'send'> & {
  send: (event: { type: string; data?: TRemoteCallerData }) => void;
};

jest.mock('@/logger', () => {
  return createLoggerMockModule();
});

const mockDebug = (resolveDebug as jest.Mock).mock.results[0].value as jest.Mock;

describe('IncomingCallStateMachine', () => {
  let incomingEvents: TIncomingEvents;
  let connectionEvents: TConnectionManagerEvents;
  let machine: TIncomingCallStateMachineForTests;

  const sampleCaller: TRemoteCallerData = {
    displayName: 'Test Caller',
    host: 'test.com',
    incomingNumber: '101',
    rtcSession: new RTCSessionMock({ eventHandlers: {}, originator: 'remote' }),
  };

  beforeEach(() => {
    mockDebug.mockClear();
    incomingEvents = createIncomingEvents();
    connectionEvents = createConnectionEvents();
    machine = new IncomingCallStateMachine({
      incomingEvents,
      connectionEvents,
    }) as TIncomingCallStateMachineForTests;
  });

  afterEach(() => {
    machine.stop();
  });

  describe('Табличные переходы по доменным событиям', () => {
    const transitions: {
      title: string;
      arrange?: () => void;
      event: { type: string; data?: TRemoteCallerData };
      expected: EIncomingStatus;
    }[] = [
      {
        title: 'INCOMING.RINGING из IDLE в RINGING',
        event: { type: 'INCOMING.RINGING', data: sampleCaller },
        expected: EIncomingStatus.RINGING,
      },
      {
        title: 'INCOMING.CLEAR из IDLE остаётся в IDLE',
        event: { type: 'INCOMING.CLEAR' },
        expected: EIncomingStatus.IDLE,
      },
      {
        title: 'INCOMING.CONSUMED из RINGING в CONSUMED',
        arrange: () => {
          machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
        },
        event: { type: 'INCOMING.CONSUMED' },
        expected: EIncomingStatus.CONSUMED,
      },
      {
        title: 'INCOMING.DECLINED из RINGING в DECLINED',
        arrange: () => {
          machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
        },
        event: { type: 'INCOMING.DECLINED', data: sampleCaller },
        expected: EIncomingStatus.DECLINED,
      },
      {
        title: 'INCOMING.TERMINATED из RINGING в TERMINATED',
        arrange: () => {
          machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
        },
        event: { type: 'INCOMING.TERMINATED', data: sampleCaller },
        expected: EIncomingStatus.TERMINATED,
      },
      {
        title: 'INCOMING.FAILED из RINGING в FAILED',
        arrange: () => {
          machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
        },
        event: { type: 'INCOMING.FAILED', data: sampleCaller },
        expected: EIncomingStatus.FAILED,
      },
      {
        title: 'INCOMING.CLEAR из RINGING в IDLE',
        arrange: () => {
          machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
        },
        event: { type: 'INCOMING.CLEAR' },
        expected: EIncomingStatus.IDLE,
      },
      {
        title: 'INCOMING.RINGING из CONSUMED возвращает в RINGING',
        arrange: () => {
          machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
          machine.send({ type: 'INCOMING.CONSUMED' });
        },
        event: { type: 'INCOMING.RINGING', data: sampleCaller },
        expected: EIncomingStatus.RINGING,
      },
      {
        title: 'INCOMING.CLEAR из CONSUMED в IDLE',
        arrange: () => {
          machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
          machine.send({ type: 'INCOMING.CONSUMED' });
        },
        event: { type: 'INCOMING.CLEAR' },
        expected: EIncomingStatus.IDLE,
      },
      {
        title: 'INCOMING.RINGING из DECLINED возвращает в RINGING',
        arrange: () => {
          machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
          machine.send({ type: 'INCOMING.DECLINED', data: sampleCaller });
        },
        event: { type: 'INCOMING.RINGING', data: sampleCaller },
        expected: EIncomingStatus.RINGING,
      },
      {
        title: 'INCOMING.CLEAR из DECLINED в IDLE',
        arrange: () => {
          machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
          machine.send({ type: 'INCOMING.DECLINED', data: sampleCaller });
        },
        event: { type: 'INCOMING.CLEAR' },
        expected: EIncomingStatus.IDLE,
      },
      {
        title: 'INCOMING.RINGING из TERMINATED возвращает в RINGING',
        arrange: () => {
          machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
          machine.send({ type: 'INCOMING.TERMINATED', data: sampleCaller });
        },
        event: { type: 'INCOMING.RINGING', data: sampleCaller },
        expected: EIncomingStatus.RINGING,
      },
      {
        title: 'INCOMING.CLEAR из TERMINATED в IDLE',
        arrange: () => {
          machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
          machine.send({ type: 'INCOMING.TERMINATED', data: sampleCaller });
        },
        event: { type: 'INCOMING.CLEAR' },
        expected: EIncomingStatus.IDLE,
      },
      {
        title: 'INCOMING.RINGING из FAILED возвращает в RINGING',
        arrange: () => {
          machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
          machine.send({ type: 'INCOMING.FAILED', data: sampleCaller });
        },
        event: { type: 'INCOMING.RINGING', data: sampleCaller },
        expected: EIncomingStatus.RINGING,
      },
      {
        title: 'INCOMING.CLEAR из FAILED в IDLE',
        arrange: () => {
          machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
          machine.send({ type: 'INCOMING.FAILED', data: sampleCaller });
        },
        event: { type: 'INCOMING.CLEAR' },
        expected: EIncomingStatus.IDLE,
      },
    ];

    it.each(transitions)('$title', ({ arrange, event, expected }) => {
      arrange?.();

      machine.send(event as never);

      expect(machine.state).toBe(expected);
    });
  });

  describe('Геттеры состояний', () => {
    it('isIdle возвращает true только в IDLE', () => {
      expect(machine.isIdle).toBe(true);
      expect(machine.isRinging).toBe(false);
      expect(machine.isConsumed).toBe(false);
      expect(machine.isDeclined).toBe(false);
      expect(machine.isTerminated).toBe(false);
      expect(machine.isFailed).toBe(false);
    });

    it('isRinging возвращает true только в RINGING', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      expect(machine.isIdle).toBe(false);
      expect(machine.isRinging).toBe(true);
      expect(machine.isConsumed).toBe(false);
      expect(machine.isDeclined).toBe(false);
      expect(machine.isTerminated).toBe(false);
      expect(machine.isFailed).toBe(false);
    });

    it('isConsumed возвращает true только в CONSUMED', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      machine.send({ type: 'INCOMING.CONSUMED' });
      expect(machine.isIdle).toBe(false);
      expect(machine.isRinging).toBe(false);
      expect(machine.isConsumed).toBe(true);
      expect(machine.isDeclined).toBe(false);
      expect(machine.isTerminated).toBe(false);
      expect(machine.isFailed).toBe(false);
    });

    it('isDeclined возвращает true только в DECLINED', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      machine.send({ type: 'INCOMING.DECLINED', data: sampleCaller });
      expect(machine.isIdle).toBe(false);
      expect(machine.isRinging).toBe(false);
      expect(machine.isConsumed).toBe(false);
      expect(machine.isDeclined).toBe(true);
      expect(machine.isTerminated).toBe(false);
      expect(machine.isFailed).toBe(false);
    });

    it('isTerminated возвращает true только в TERMINATED', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      machine.send({ type: 'INCOMING.TERMINATED', data: sampleCaller });
      expect(machine.isIdle).toBe(false);
      expect(machine.isRinging).toBe(false);
      expect(machine.isConsumed).toBe(false);
      expect(machine.isDeclined).toBe(false);
      expect(machine.isTerminated).toBe(true);
      expect(machine.isFailed).toBe(false);
    });

    it('isFailed возвращает true только в FAILED', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      machine.send({ type: 'INCOMING.FAILED', data: sampleCaller });
      expect(machine.isIdle).toBe(false);
      expect(machine.isRinging).toBe(false);
      expect(machine.isConsumed).toBe(false);
      expect(machine.isDeclined).toBe(false);
      expect(machine.isTerminated).toBe(false);
      expect(machine.isFailed).toBe(true);
    });

    it('isActive возвращает true только для RINGING', () => {
      expect(machine.isActive).toBe(false);

      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      expect(machine.isActive).toBe(true);

      machine.send({ type: 'INCOMING.CONSUMED' });
      expect(machine.isActive).toBe(false);
    });

    it('isFinished возвращает true для CONSUMED, DECLINED, TERMINATED и FAILED', () => {
      expect(machine.isFinished).toBe(false);

      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      expect(machine.isFinished).toBe(false);

      machine.send({ type: 'INCOMING.CONSUMED' });
      expect(machine.isFinished).toBe(true);

      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      machine.send({ type: 'INCOMING.DECLINED', data: sampleCaller });
      expect(machine.isFinished).toBe(true);

      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      machine.send({ type: 'INCOMING.TERMINATED', data: sampleCaller });
      expect(machine.isFinished).toBe(true);

      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      machine.send({ type: 'INCOMING.FAILED', data: sampleCaller });
      expect(machine.isFinished).toBe(true);
    });
  });

  describe('Геттеры контекста', () => {
    it('remoteCallerData изначально undefined', () => {
      expect(machine.remoteCallerData).toBeUndefined();
    });

    it('remoteCallerData сохраняется при RINGING', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      expect(machine.remoteCallerData).toEqual(sampleCaller);
    });

    it('lastReason сохраняется при переходах в финальные состояния', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      machine.send({ type: 'INCOMING.CONSUMED' });
      expect(machine.lastReason).toBe(EIncomingStatus.CONSUMED);

      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      machine.send({ type: 'INCOMING.DECLINED', data: sampleCaller });
      expect(machine.lastReason).toBe(EIncomingStatus.DECLINED);

      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      machine.send({ type: 'INCOMING.TERMINATED', data: sampleCaller });
      expect(machine.lastReason).toBe(EIncomingStatus.TERMINATED);

      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      machine.send({ type: 'INCOMING.FAILED', data: sampleCaller });
      expect(machine.lastReason).toBe(EIncomingStatus.FAILED);
    });

    it('lastReason очищается при CLEAR', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      machine.send({ type: 'INCOMING.CONSUMED' });
      expect(machine.lastReason).toBe(EIncomingStatus.CONSUMED);

      machine.send({ type: 'INCOMING.CLEAR' });
      expect(machine.lastReason).toBeUndefined();
      expect(machine.remoteCallerData).toBeUndefined();
    });
  });

  describe('Валидация переходов', () => {
    it('предупреждает при попытке IDLE → CONSUMED', () => {
      machine.send({ type: 'INCOMING.CONSUMED' });

      expect(machine.state).toBe(EIncomingStatus.IDLE);
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining(
          '[IncomingCallStateMachine] Invalid transition: INCOMING.CONSUMED from incoming:idle',
        ),
      );
    });

    it('предупреждает при попытке IDLE → DECLINED', () => {
      machine.send({ type: 'INCOMING.DECLINED', data: sampleCaller });

      expect(machine.state).toBe(EIncomingStatus.IDLE);
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining(
          '[IncomingCallStateMachine] Invalid transition: INCOMING.DECLINED from incoming:idle',
        ),
      );
    });

    it('предупреждает при попытке CONSUMED → DECLINED', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      machine.send({ type: 'INCOMING.CONSUMED' });
      machine.send({ type: 'INCOMING.DECLINED', data: sampleCaller });

      expect(machine.state).toBe(EIncomingStatus.CONSUMED);
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining(
          '[IncomingCallStateMachine] Invalid transition: INCOMING.DECLINED from incoming:consumed',
        ),
      );
    });

    it('предупреждает при повторном INCOMING.CONSUMED из CONSUMED', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      machine.send({ type: 'INCOMING.CONSUMED' });
      machine.send({ type: 'INCOMING.CONSUMED' });

      expect(machine.state).toBe(EIncomingStatus.CONSUMED);
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining(
          '[IncomingCallStateMachine] Invalid transition: INCOMING.CONSUMED from incoming:consumed',
        ),
      );
    });

    it('не предупреждает при допустимых переходах', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      machine.send({ type: 'INCOMING.CONSUMED' });
      machine.send({ type: 'INCOMING.CLEAR' });

      expect(mockDebug).not.toHaveBeenCalledWith(expect.stringContaining('Invalid transition:'));
    });
  });

  describe('Публичный метод reset()', () => {
    it('переводит из RINGING в IDLE через reset()', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      expect(machine.state).toBe(EIncomingStatus.RINGING);

      machine.reset();
      expect(machine.state).toBe(EIncomingStatus.IDLE);
    });

    it('переводит из FAILED в IDLE через reset()', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      machine.send({ type: 'INCOMING.FAILED', data: sampleCaller });
      expect(machine.state).toBe(EIncomingStatus.FAILED);

      machine.reset();
      expect(machine.state).toBe(EIncomingStatus.IDLE);
    });

    it('очищает remoteCallerData и lastReason при reset', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      machine.send({ type: 'INCOMING.CONSUMED' });
      expect(machine.remoteCallerData).toBeDefined();
      expect(machine.lastReason).toBe(EIncomingStatus.CONSUMED);

      machine.reset();
      expect(machine.remoteCallerData).toBeUndefined();
      expect(machine.lastReason).toBeUndefined();
    });
  });

  describe('Полный жизненный цикл входящего звонка', () => {
    it('успешный флоу: IDLE → RINGING → CONSUMED → IDLE', () => {
      expect(machine.state).toBe(EIncomingStatus.IDLE);

      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      expect(machine.state).toBe(EIncomingStatus.RINGING);

      machine.send({ type: 'INCOMING.CONSUMED' });
      expect(machine.state).toBe(EIncomingStatus.CONSUMED);

      machine.send({ type: 'INCOMING.CLEAR' });
      expect(machine.state).toBe(EIncomingStatus.IDLE);
    });

    it('отклонение: IDLE → RINGING → DECLINED → IDLE', () => {
      expect(machine.state).toBe(EIncomingStatus.IDLE);

      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      expect(machine.state).toBe(EIncomingStatus.RINGING);

      machine.send({ type: 'INCOMING.DECLINED', data: sampleCaller });
      expect(machine.state).toBe(EIncomingStatus.DECLINED);

      machine.send({ type: 'INCOMING.CLEAR' });
      expect(machine.state).toBe(EIncomingStatus.IDLE);
    });

    it('обрыв: IDLE → RINGING → TERMINATED → IDLE', () => {
      expect(machine.state).toBe(EIncomingStatus.IDLE);

      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      expect(machine.state).toBe(EIncomingStatus.RINGING);

      machine.send({ type: 'INCOMING.TERMINATED', data: sampleCaller });
      expect(machine.state).toBe(EIncomingStatus.TERMINATED);

      machine.send({ type: 'INCOMING.CLEAR' });
      expect(machine.state).toBe(EIncomingStatus.IDLE);
    });

    it('ошибка: IDLE → RINGING → FAILED → IDLE', () => {
      expect(machine.state).toBe(EIncomingStatus.IDLE);

      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      expect(machine.state).toBe(EIncomingStatus.RINGING);

      machine.send({ type: 'INCOMING.FAILED', data: sampleCaller });
      expect(machine.state).toBe(EIncomingStatus.FAILED);

      machine.send({ type: 'INCOMING.CLEAR' });
      expect(machine.state).toBe(EIncomingStatus.IDLE);
    });
  });

  describe('Интеграция с ConnectionManager', () => {
    it('триггер disconnected очищает состояние', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      expect(machine.state).toBe(EIncomingStatus.RINGING);

      connectionEvents.trigger('disconnected', { socket: {} as Socket, error: false });
      expect(machine.state).toBe(EIncomingStatus.IDLE);
      expect(machine.remoteCallerData).toBeUndefined();
    });

    it('триггер registrationFailed очищает состояние', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      machine.send({ type: 'INCOMING.CONSUMED' });
      expect(machine.state).toBe(EIncomingStatus.CONSUMED);

      connectionEvents.trigger('registrationFailed', {
        response: { status_code: 403, reason_phrase: 'Forbidden' },
      } as never);
      expect(machine.state).toBe(EIncomingStatus.IDLE);
    });

    it('триггер connect-failed очищает состояние', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      machine.send({ type: 'INCOMING.DECLINED', data: sampleCaller });
      expect(machine.state).toBe(EIncomingStatus.DECLINED);

      connectionEvents.trigger('connect-failed', new Error('Connection failed'));
      expect(machine.state).toBe(EIncomingStatus.IDLE);
    });

    it('валидация работает через события ConnectionManager', () => {
      // Попытка перейти в CONSUMED напрямую из IDLE через событие
      machine.send({ type: 'INCOMING.CONSUMED' });

      expect(machine.state).toBe(EIncomingStatus.IDLE);
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining('[IncomingCallStateMachine] Invalid transition'),
      );
    });
  });

  describe('toConsumed', () => {
    it('should transition from RINGING to CONSUMED', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      expect(machine.state).toBe(EIncomingStatus.RINGING);

      machine.toConsumed();

      expect(machine.state).toBe(EIncomingStatus.CONSUMED);
    });

    it('should preserve remoteCallerData when transitioning to CONSUMED', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      expect(machine.state).toBe(EIncomingStatus.RINGING);

      machine.toConsumed();

      expect(machine.state).toBe(EIncomingStatus.CONSUMED);

      const snapshot = machine.getSnapshot();

      expect(snapshot.context.remoteCallerData).toEqual(sampleCaller);
      expect(snapshot.context.lastReason).toBe(EIncomingStatus.CONSUMED);
    });

    it('should not transition from IDLE to CONSUMED', () => {
      expect(machine.state).toBe(EIncomingStatus.IDLE);

      machine.toConsumed();

      // Should remain in IDLE as there's no transition from IDLE to CONSUMED
      expect(machine.state).toBe(EIncomingStatus.IDLE);
    });

    it('should not transition from CONSUMED to CONSUMED (self-transition)', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      machine.toConsumed();
      expect(machine.state).toBe(EIncomingStatus.CONSUMED);

      machine.toConsumed();

      // Should remain in CONSUMED as there's no transition from CONSUMED to CONSUMED
      expect(machine.state).toBe(EIncomingStatus.CONSUMED);
    });
  });
});
