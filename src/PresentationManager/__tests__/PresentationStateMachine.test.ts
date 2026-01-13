import { createMediaStreamMock } from 'webrtc-mock';

import { createEvents as createCallEvents, ECallEvent } from '@/CallManager';
import { PresentationStateMachine, EState } from '../PresentationStateMachine';

import type { TCallEvents } from '@/CallManager';

describe('PresentationStateMachine', () => {
  let callEvents: TCallEvents;
  let machine: PresentationStateMachine;
  let mediaStream: MediaStream;

  const getContext = () => {
    return machine.getSnapshot().context as { lastError?: unknown };
  };

  beforeEach(() => {
    callEvents = createCallEvents();
    machine = new PresentationStateMachine(callEvents);
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });
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
      expectedError?: unknown;
    }[] = [
      {
        title: 'SCREEN.STARTING из IDLE в STARTING и сброс ошибки',
        event: { type: 'SCREEN.STARTING' },
        expected: EState.STARTING,
        expectedError: undefined,
      },
      {
        title: 'SCREEN.FAILED из IDLE в FAILED и запоминает ошибку',
        event: { type: 'SCREEN.FAILED', error: 'boom' },
        expected: EState.FAILED,
        expectedError: 'boom',
      },
      {
        title: 'SCREEN.STARTED из STARTING в ACTIVE',
        arrange: () => {
          machine.send({ type: 'SCREEN.STARTING' });
        },
        event: { type: 'SCREEN.STARTED' },
        expected: EState.ACTIVE,
      },
      {
        title: 'SCREEN.FAILED из STARTING в FAILED и запоминает ошибку',
        arrange: () => {
          machine.send({ type: 'SCREEN.STARTING' });
        },
        event: { type: 'SCREEN.FAILED', error: 'err-starting' },
        expected: EState.FAILED,
        expectedError: 'err-starting',
      },
      {
        title: 'SCREEN.ENDED из STARTING в IDLE со сбросом ошибки',
        arrange: () => {
          machine.send({ type: 'SCREEN.STARTING' });
          machine.send({ type: 'SCREEN.FAILED', error: 'prev' });
          machine.send({ type: 'SCREEN.STARTING' });
        },
        event: { type: 'SCREEN.ENDED' },
        expected: EState.IDLE,
        expectedError: undefined,
      },
      {
        title: 'CALL.ENDED из STARTING в IDLE',
        arrange: () => {
          machine.send({ type: 'SCREEN.STARTING' });
        },
        event: { type: 'CALL.ENDED' },
        expected: EState.IDLE,
      },
      {
        title: 'SCREEN.ENDING из ACTIVE в STOPPING',
        arrange: () => {
          machine.send({ type: 'SCREEN.STARTING' });
          machine.send({ type: 'SCREEN.STARTED' });
        },
        event: { type: 'SCREEN.ENDING' },
        expected: EState.STOPPING,
      },
      {
        title: 'SCREEN.ENDED из ACTIVE в IDLE',
        arrange: () => {
          machine.send({ type: 'SCREEN.STARTING' });
          machine.send({ type: 'SCREEN.STARTED' });
        },
        event: { type: 'SCREEN.ENDED' },
        expected: EState.IDLE,
      },
      {
        title: 'SCREEN.FAILED из ACTIVE в FAILED и запоминает ошибку',
        arrange: () => {
          machine.send({ type: 'SCREEN.STARTING' });
          machine.send({ type: 'SCREEN.STARTED' });
        },
        event: { type: 'SCREEN.FAILED', error: 'active-fail' },
        expected: EState.FAILED,
        expectedError: 'active-fail',
      },
      {
        title: 'SCREEN.FAILED из ACTIVE без error оставляет lastError undefined',
        arrange: () => {
          machine.send({ type: 'SCREEN.STARTING' });
          machine.send({ type: 'SCREEN.STARTED' });
        },
        event: { type: 'SCREEN.FAILED' },
        expected: EState.FAILED,
        expectedError: undefined,
      },
      {
        title: 'CALL.ENDED из ACTIVE в IDLE',
        arrange: () => {
          machine.send({ type: 'SCREEN.STARTING' });
          machine.send({ type: 'SCREEN.STARTED' });
        },
        event: { type: 'CALL.ENDED' },
        expected: EState.IDLE,
      },
      {
        title: 'CALL.FAILED из ACTIVE в FAILED и запоминает ошибку',
        arrange: () => {
          machine.send({ type: 'SCREEN.STARTING' });
          machine.send({ type: 'SCREEN.STARTED' });
        },
        event: { type: 'CALL.FAILED', error: 'call-fail' },
        expected: EState.FAILED,
        expectedError: 'call-fail',
      },
      {
        title: 'SCREEN.ENDED из STOPPING в IDLE',
        arrange: () => {
          machine.send({ type: 'SCREEN.STARTING' });
          machine.send({ type: 'SCREEN.STARTED' });
          machine.send({ type: 'SCREEN.ENDING' });
        },
        event: { type: 'SCREEN.ENDED' },
        expected: EState.IDLE,
      },
      {
        title: 'SCREEN.FAILED из STOPPING в FAILED и запоминает ошибку',
        arrange: () => {
          machine.send({ type: 'SCREEN.STARTING' });
          machine.send({ type: 'SCREEN.STARTED' });
          machine.send({ type: 'SCREEN.ENDING' });
        },
        event: { type: 'SCREEN.FAILED', error: 'stop-fail' },
        expected: EState.FAILED,
        expectedError: 'stop-fail',
      },
      {
        title: 'CALL.ENDED из STOPPING в IDLE',
        arrange: () => {
          machine.send({ type: 'SCREEN.STARTING' });
          machine.send({ type: 'SCREEN.STARTED' });
          machine.send({ type: 'SCREEN.ENDING' });
        },
        event: { type: 'CALL.ENDED' },
        expected: EState.IDLE,
      },
      {
        title: 'SCREEN.STARTING из FAILED в STARTING сбрасывает ошибку',
        arrange: () => {
          machine.send({ type: 'SCREEN.FAILED', error: 'old-error' });
        },
        event: { type: 'SCREEN.STARTING' },
        expected: EState.STARTING,
        expectedError: undefined,
      },
      {
        title: 'SCREEN.ENDED из FAILED в IDLE сбрасывает ошибку',
        arrange: () => {
          machine.send({ type: 'SCREEN.FAILED', error: 'old-error' });
        },
        event: { type: 'SCREEN.ENDED' },
        expected: EState.IDLE,
        expectedError: undefined,
      },
    ];

    test.each(transitions)('$title', ({ arrange, event, expected, expectedError }) => {
      arrange?.();

      machine.send(event as never);

      expect(machine.state).toBe(expected);
      expect(getContext().lastError).toBe(expectedError);
    });
  });

  describe('Контракт адаптера событий менеджеров', () => {
    it('обрабатывает цепочку событий от менеджеров', () => {
      // start sharing
      callEvents.trigger(ECallEvent.START_PRESENTATION, mediaStream);
      expect(machine.state).toBe(EState.STARTING);
      expect(getContext().lastError).toBeUndefined();

      // started
      callEvents.trigger(ECallEvent.STARTED_PRESENTATION, mediaStream);
      expect(machine.state).toBe(EState.ACTIVE);

      // end request
      callEvents.trigger(ECallEvent.END_PRESENTATION, mediaStream);
      expect(machine.state).toBe(EState.STOPPING);

      // ended -> idle
      callEvents.trigger(ECallEvent.ENDED_PRESENTATION, mediaStream);
      expect(machine.state).toBe(EState.IDLE);

      // new start and failure from call
      callEvents.trigger(ECallEvent.START_PRESENTATION, mediaStream);
      callEvents.trigger(ECallEvent.STARTED_PRESENTATION, mediaStream);
      callEvents.trigger(ECallEvent.FAILED_PRESENTATION, new Error('call failed'));
      expect(machine.state).toBe(EState.FAILED);
      expect(getContext().lastError).toBeInstanceOf(Error);
    });
  });
});
