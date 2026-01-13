import { createEvents as createConnectionEvents } from '@/ConnectionManager';
import { createEvents as createIncomingEvents } from '../events';
import { IncomingCallStateMachine, EState } from '../IncomingCallStateMachine';

import type { TConnectionManagerEvents } from '@/ConnectionManager';
import type { TEvents as TIncomingEvents, TRemoteCallerData } from '../events';

describe('IncomingCallStateMachine', () => {
  let incomingEvents: TIncomingEvents;
  let connectionEvents: TConnectionManagerEvents;
  let machine: IncomingCallStateMachine;

  const sampleCaller: TRemoteCallerData = { incomingNumber: '101' };

  beforeEach(() => {
    incomingEvents = createIncomingEvents();
    connectionEvents = createConnectionEvents();
    machine = new IncomingCallStateMachine({
      incomingEvents,
      connectionEvents,
    });
  });

  afterEach(() => {
    machine.stop();
  });

  describe('Табличные переходы по доменным событиям', () => {
    const transitions: {
      title: string;
      arrange?: () => void;
      event: { type: string; data?: TRemoteCallerData };
      expected: EState;
    }[] = [
      {
        title: 'INCOMING.RINGING из IDLE в RINGING',
        event: { type: 'INCOMING.RINGING', data: sampleCaller },
        expected: EState.RINGING,
      },
      {
        title: 'INCOMING.CLEAR из IDLE остаётся в IDLE',
        event: { type: 'INCOMING.CLEAR' },
        expected: EState.IDLE,
      },
      {
        title: 'INCOMING.CONSUMED из RINGING в CONSUMED',
        arrange: () => {
          machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
        },
        event: { type: 'INCOMING.CONSUMED' },
        expected: EState.CONSUMED,
      },
      {
        title: 'INCOMING.DECLINED из RINGING в DECLINED',
        arrange: () => {
          machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
        },
        event: { type: 'INCOMING.DECLINED', data: sampleCaller },
        expected: EState.DECLINED,
      },
      {
        title: 'INCOMING.TERMINATED из RINGING в TERMINATED',
        arrange: () => {
          machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
        },
        event: { type: 'INCOMING.TERMINATED', data: sampleCaller },
        expected: EState.TERMINATED,
      },
      {
        title: 'INCOMING.FAILED из RINGING в FAILED',
        arrange: () => {
          machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
        },
        event: { type: 'INCOMING.FAILED', data: sampleCaller },
        expected: EState.FAILED,
      },
      {
        title: 'INCOMING.CLEAR из RINGING в IDLE',
        arrange: () => {
          machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
        },
        event: { type: 'INCOMING.CLEAR' },
        expected: EState.IDLE,
      },
      {
        title: 'INCOMING.RINGING из CONSUMED возвращает в RINGING',
        arrange: () => {
          machine.send({ type: 'INCOMING.CONSUMED' });
        },
        event: { type: 'INCOMING.RINGING', data: sampleCaller },
        expected: EState.RINGING,
      },
      {
        title: 'INCOMING.CLEAR из CONSUMED в IDLE',
        arrange: () => {
          machine.send({ type: 'INCOMING.CONSUMED' });
        },
        event: { type: 'INCOMING.CLEAR' },
        expected: EState.IDLE,
      },
      {
        title: 'INCOMING.RINGING из DECLINED возвращает в RINGING',
        arrange: () => {
          machine.send({ type: 'INCOMING.DECLINED', data: sampleCaller });
        },
        event: { type: 'INCOMING.RINGING', data: sampleCaller },
        expected: EState.RINGING,
      },
      {
        title: 'INCOMING.CLEAR из DECLINED в IDLE',
        arrange: () => {
          machine.send({ type: 'INCOMING.DECLINED', data: sampleCaller });
        },
        event: { type: 'INCOMING.CLEAR' },
        expected: EState.IDLE,
      },
      {
        title: 'INCOMING.RINGING из TERMINATED возвращает в RINGING',
        arrange: () => {
          machine.send({ type: 'INCOMING.TERMINATED', data: sampleCaller });
        },
        event: { type: 'INCOMING.RINGING', data: sampleCaller },
        expected: EState.RINGING,
      },
      {
        title: 'INCOMING.CLEAR из TERMINATED в IDLE',
        arrange: () => {
          machine.send({ type: 'INCOMING.TERMINATED', data: sampleCaller });
        },
        event: { type: 'INCOMING.CLEAR' },
        expected: EState.IDLE,
      },
      {
        title: 'INCOMING.RINGING из FAILED возвращает в RINGING',
        arrange: () => {
          machine.send({ type: 'INCOMING.FAILED', data: sampleCaller });
        },
        event: { type: 'INCOMING.RINGING', data: sampleCaller },
        expected: EState.RINGING,
      },
      {
        title: 'INCOMING.CLEAR из FAILED в IDLE',
        arrange: () => {
          machine.send({ type: 'INCOMING.FAILED', data: sampleCaller });
        },
        event: { type: 'INCOMING.CLEAR' },
        expected: EState.IDLE,
      },
    ];

    test.each(transitions)('$title', ({ arrange, event, expected }) => {
      arrange?.();

      machine.send(event as never);

      expect(machine.state).toBe(expected);
    });
  });

  describe('toConsumed', () => {
    it('should transition from RINGING to CONSUMED', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      expect(machine.state).toBe(EState.RINGING);

      machine.toConsumed();

      expect(machine.state).toBe(EState.CONSUMED);
    });

    it('should preserve remoteCallerData when transitioning to CONSUMED', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      expect(machine.state).toBe(EState.RINGING);

      machine.toConsumed();

      expect(machine.state).toBe(EState.CONSUMED);

      const snapshot = machine.getSnapshot();

      expect(snapshot.context.remoteCallerData).toEqual(sampleCaller);
      expect(snapshot.context.lastReason).toBe(EState.CONSUMED);
    });

    it('should not transition from IDLE to CONSUMED', () => {
      expect(machine.state).toBe(EState.IDLE);

      machine.toConsumed();

      // Should remain in IDLE as there's no transition from IDLE to CONSUMED
      expect(machine.state).toBe(EState.IDLE);
    });

    it('should not transition from CONSUMED to CONSUMED (self-transition)', () => {
      machine.send({ type: 'INCOMING.RINGING', data: sampleCaller });
      machine.toConsumed();
      expect(machine.state).toBe(EState.CONSUMED);

      machine.toConsumed();

      // Should remain in CONSUMED as there's no transition from CONSUMED to CONSUMED
      expect(machine.state).toBe(EState.CONSUMED);
    });
  });
});
