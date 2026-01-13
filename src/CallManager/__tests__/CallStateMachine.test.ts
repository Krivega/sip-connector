import { CallStateMachine, EState } from '../CallStateMachine';
import { createEvents } from '../events';

import type { TEvent, TEvents } from '../events';

describe('CallStateMachine', () => {
  let events: TEvents;
  let machine: CallStateMachine;

  beforeEach(() => {
    events = createEvents();
    machine = new CallStateMachine(events);
  });

  afterEach(() => {
    machine.stop();
  });

  describe('Табличные переходы по доменным событиям', () => {
    const transitions: {
      title: string;
      arrange?: () => void;
      event: { type: string; error?: unknown };
      expected: EState;
    }[] = [
      {
        title: 'CALL.CONNECTING из IDLE в CONNECTING',
        event: { type: 'CALL.CONNECTING' },
        expected: EState.CONNECTING,
      },
      {
        title: 'CALL.RINGING из IDLE в RINGING',
        event: { type: 'CALL.RINGING' },
        expected: EState.RINGING,
      },
      {
        title: 'CALL.ACCEPTED из IDLE в ACCEPTED',
        event: { type: 'CALL.ACCEPTED' },
        expected: EState.ACCEPTED,
      },
      {
        title: 'CALL.CONFIRMED из IDLE в IN_CALL',
        event: { type: 'CALL.CONFIRMED' },
        expected: EState.IN_CALL,
      },
      {
        title: 'CALL.ENDED из CONNECTING в ENDED',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING' });
        },
        event: { type: 'CALL.ENDED' },
        expected: EState.ENDED,
      },
      {
        title: 'CALL.FAILED из CONNECTING в FAILED',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING' });
        },
        event: { type: 'CALL.FAILED', error: new Error('fail') },
        expected: EState.FAILED,
      },
      {
        title: 'CALL.FAILED без error из CONNECTING в FAILED (coverage lastError undefined)',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING' });
        },
        event: { type: 'CALL.FAILED' },
        expected: EState.FAILED,
      },
      {
        title: 'CALL.CONFIRMED из RINGING в IN_CALL',
        arrange: () => {
          machine.send({ type: 'CALL.RINGING' });
        },
        event: { type: 'CALL.CONFIRMED' },
        expected: EState.IN_CALL,
      },
      {
        title: 'CALL.ACCEPTED из RINGING в ACCEPTED',
        arrange: () => {
          machine.send({ type: 'CALL.RINGING' });
        },
        event: { type: 'CALL.ACCEPTED' },
        expected: EState.ACCEPTED,
      },
      {
        title: 'CALL.ENDED из IN_CALL в ENDED',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING' });
          machine.send({ type: 'CALL.CONFIRMED' });
        },
        event: { type: 'CALL.ENDED' },
        expected: EState.ENDED,
      },
      {
        title: 'CALL.FAILED из IN_CALL в FAILED',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING' });
          machine.send({ type: 'CALL.CONFIRMED' });
        },
        event: { type: 'CALL.FAILED', error: new Error('fail') },
        expected: EState.FAILED,
      },
      {
        title: 'CALL.CONNECTING из ENDED возвращает в CONNECTING',
        arrange: () => {
          machine.send({ type: 'CALL.ENDED' });
        },
        event: { type: 'CALL.CONNECTING' },
        expected: EState.CONNECTING,
      },
      {
        title: 'CALL.RINGING из FAILED возвращает в RINGING',
        arrange: () => {
          machine.send({ type: 'CALL.FAILED' });
        },
        event: { type: 'CALL.RINGING' },
        expected: EState.RINGING,
      },
    ];

    test.each(transitions)('$title', ({ arrange, event, expected }) => {
      arrange?.();

      machine.send(event as never);

      expect(machine.state).toBe(expected);
    });
  });

  describe('Контракт адаптера событий менеджеров', () => {
    const scenarios: {
      title: string;
      steps: {
        event: TEvent;
        payload?: unknown;
        expected: EState;
      }[];
    }[] = [
      {
        title: 'успешный звонок (connecting → ringing → accepted → confirmed → ended)',
        steps: [
          { event: 'connecting', expected: EState.CONNECTING },
          { event: 'progress', expected: EState.RINGING },
          { event: 'accepted', expected: EState.ACCEPTED },
          { event: 'confirmed', expected: EState.IN_CALL },
          { event: 'ended', expected: EState.ENDED },
        ],
      },
      {
        title: 'ошибка звонка (connecting → ringing → failed)',
        steps: [
          { event: 'connecting', expected: EState.CONNECTING },
          { event: 'progress', expected: EState.RINGING },
          { event: 'failed', expected: EState.FAILED },
        ],
      },
      {
        title: 'ошибка звонка без error (connecting → failed)',
        steps: [
          { event: 'connecting', expected: EState.CONNECTING },
          { event: 'failed', expected: EState.FAILED },
        ],
      },
    ];

    test.each(scenarios)('$title', ({ steps }) => {
      for (const step of steps) {
        events.trigger(step.event as never, step.payload as never);
        expect(machine.state).toBe(step.expected);
      }
    });
  });
});
