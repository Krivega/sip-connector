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
        title: 'CALL.FAILED из STARTING в FAILED и запоминает ошибку',
        arrange: () => {
          machine.send({ type: 'SCREEN.STARTING' });
        },
        event: { type: 'CALL.FAILED', error: 'call-failed-starting' },
        expected: EState.FAILED,
        expectedError: 'call-failed-starting',
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
        title: 'CALL.FAILED из STOPPING в FAILED и запоминает ошибку',
        arrange: () => {
          machine.send({ type: 'SCREEN.STARTING' });
          machine.send({ type: 'SCREEN.STARTED' });
          machine.send({ type: 'SCREEN.ENDING' });
        },
        event: { type: 'CALL.FAILED', error: 'call-failed-stopping' },
        expected: EState.FAILED,
        expectedError: 'call-failed-stopping',
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

    it.each(transitions)('$title', ({ arrange, event, expected, expectedError }) => {
      arrange?.();

      machine.send(event as never);

      expect(machine.state).toBe(expected);

      if (expectedError === undefined) {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(getContext().lastError).toBeUndefined();
      } else {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(getContext().lastError).toBeInstanceOf(Error);
        // @ts-expect-error - expectedError is a string
        // eslint-disable-next-line jest/no-conditional-expect, @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions
        expect(getContext().lastError?.message).toBe(`"${expectedError}"`);
      }
    });
  });

  describe('Геттеры состояний', () => {
    it('isIdle возвращает true только в IDLE', () => {
      expect(machine.isIdle).toBe(true);
      expect(machine.isStarting).toBe(false);
      expect(machine.isActive).toBe(false);
      expect(machine.isStopping).toBe(false);
      expect(machine.isFailed).toBe(false);
    });

    it('isStarting возвращает true только в STARTING', () => {
      machine.send({ type: 'SCREEN.STARTING' });
      expect(machine.isIdle).toBe(false);
      expect(machine.isStarting).toBe(true);
      expect(machine.isActive).toBe(false);
      expect(machine.isStopping).toBe(false);
      expect(machine.isFailed).toBe(false);
    });

    it('isActive возвращает true только в ACTIVE', () => {
      machine.send({ type: 'SCREEN.STARTING' });
      machine.send({ type: 'SCREEN.STARTED' });
      expect(machine.isIdle).toBe(false);
      expect(machine.isStarting).toBe(false);
      expect(machine.isActive).toBe(true);
      expect(machine.isStopping).toBe(false);
      expect(machine.isFailed).toBe(false);
    });

    it('isStopping возвращает true только в STOPPING', () => {
      machine.send({ type: 'SCREEN.STARTING' });
      machine.send({ type: 'SCREEN.STARTED' });
      machine.send({ type: 'SCREEN.ENDING' });
      expect(machine.isIdle).toBe(false);
      expect(machine.isStarting).toBe(false);
      expect(machine.isActive).toBe(false);
      expect(machine.isStopping).toBe(true);
      expect(machine.isFailed).toBe(false);
    });

    it('isFailed возвращает true только в FAILED', () => {
      machine.send({ type: 'SCREEN.STARTING' });
      machine.send({ type: 'SCREEN.FAILED', error: new Error('test') });
      expect(machine.isIdle).toBe(false);
      expect(machine.isStarting).toBe(false);
      expect(machine.isActive).toBe(false);
      expect(machine.isStopping).toBe(false);
      expect(machine.isFailed).toBe(true);
    });

    it('isPending возвращает true для STARTING и STOPPING', () => {
      expect(machine.isPending).toBe(false);

      machine.send({ type: 'SCREEN.STARTING' });
      expect(machine.isPending).toBe(true);

      machine.send({ type: 'SCREEN.STARTED' });
      expect(machine.isPending).toBe(false);

      machine.send({ type: 'SCREEN.ENDING' });
      expect(machine.isPending).toBe(true);

      machine.send({ type: 'SCREEN.ENDED' });
      expect(machine.isPending).toBe(false);
    });

    it('isActiveOrPending возвращает true для STARTING, ACTIVE и STOPPING', () => {
      expect(machine.isActiveOrPending).toBe(false);

      machine.send({ type: 'SCREEN.STARTING' });
      expect(machine.isActiveOrPending).toBe(true);

      machine.send({ type: 'SCREEN.STARTED' });
      expect(machine.isActiveOrPending).toBe(true);

      machine.send({ type: 'SCREEN.ENDING' });
      expect(machine.isActiveOrPending).toBe(true);

      machine.send({ type: 'SCREEN.ENDED' });
      expect(machine.isActiveOrPending).toBe(false);
    });
  });

  describe('Обработка ошибок', () => {
    it('lastError изначально undefined', () => {
      expect(machine.lastError).toBeUndefined();
    });

    it('сохраняет Error объект', () => {
      const error = new Error('test error');

      machine.send({ type: 'SCREEN.STARTING' });
      machine.send({ type: 'SCREEN.FAILED', error });

      expect(machine.lastError).toBe(error);
      expect(machine.lastError?.message).toBe('test error');
    });

    it('конвертирует строку в Error', () => {
      machine.send({ type: 'SCREEN.STARTING' });
      machine.send({ type: 'SCREEN.FAILED', error: 'String error' });

      expect(machine.lastError).toBeInstanceOf(Error);
      expect(machine.lastError?.message).toBe('"String error"');
    });

    it('конвертирует объект в Error', () => {
      machine.send({ type: 'SCREEN.STARTING' });
      machine.send({ type: 'SCREEN.FAILED', error: { code: 500, message: 'Server error' } });

      expect(machine.lastError).toBeInstanceOf(Error);
      expect(machine.lastError?.message).toContain('500');
      expect(machine.lastError?.message).toContain('Server error');
    });

    it('lastError undefined когда error не передан', () => {
      machine.send({ type: 'SCREEN.STARTING' });
      machine.send({ type: 'SCREEN.FAILED' });

      expect(machine.lastError).toBeUndefined();
    });

    it('очищает lastError при reset', () => {
      machine.send({ type: 'SCREEN.STARTING' });
      machine.send({ type: 'SCREEN.FAILED', error: new Error('test') });
      expect(machine.lastError).toBeDefined();

      machine.reset();
      expect(machine.lastError).toBeUndefined();
      expect(machine.state).toBe(EState.IDLE);
    });

    it('очищает lastError при новой попытке запуска', () => {
      machine.send({ type: 'SCREEN.STARTING' });
      machine.send({ type: 'SCREEN.FAILED', error: new Error('first error') });
      expect(machine.lastError).toBeDefined();

      machine.send({ type: 'SCREEN.STARTING' });
      expect(machine.lastError).toBeUndefined();
      expect(machine.state).toBe(EState.STARTING);
    });
  });

  describe('Валидация переходов', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('предупреждает при попытке IDLE → ACTIVE', () => {
      machine.send({ type: 'SCREEN.STARTED' });

      expect(machine.state).toBe(EState.IDLE);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[PresentationStateMachine] Invalid transition: SCREEN.STARTED from presentation:idle',
        ),
      );
    });

    it('предупреждает при попытке STARTING → STOPPING', () => {
      machine.send({ type: 'SCREEN.STARTING' });
      machine.send({ type: 'SCREEN.ENDING' });

      expect(machine.state).toBe(EState.STARTING);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[PresentationStateMachine] Invalid transition: SCREEN.ENDING from presentation:starting',
        ),
      );
    });

    it('предупреждает при повторном SCREEN.STARTING из STARTING', () => {
      machine.send({ type: 'SCREEN.STARTING' });
      machine.send({ type: 'SCREEN.STARTING' });

      expect(machine.state).toBe(EState.STARTING);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[PresentationStateMachine] Invalid transition: SCREEN.STARTING from presentation:starting',
        ),
      );
    });

    it('предупреждает при ACTIVE → STARTING', () => {
      machine.send({ type: 'SCREEN.STARTING' });
      machine.send({ type: 'SCREEN.STARTED' });
      machine.send({ type: 'SCREEN.STARTING' });

      expect(machine.state).toBe(EState.ACTIVE);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[PresentationStateMachine] Invalid transition: SCREEN.STARTING from presentation:active',
        ),
      );
    });

    it('не предупреждает при допустимых переходах', () => {
      machine.send({ type: 'SCREEN.STARTING' });
      machine.send({ type: 'SCREEN.STARTED' });
      machine.send({ type: 'SCREEN.ENDING' });
      machine.send({ type: 'SCREEN.ENDED' });

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('Событие PRESENTATION.RESET', () => {
    it('переводит из FAILED в IDLE через reset()', () => {
      machine.send({ type: 'SCREEN.STARTING' });
      machine.send({ type: 'SCREEN.FAILED', error: new Error('test') });
      expect(machine.state).toBe(EState.FAILED);

      machine.reset();
      expect(machine.state).toBe(EState.IDLE);
    });

    it('очищает lastError при reset', () => {
      machine.send({ type: 'SCREEN.STARTING' });
      machine.send({ type: 'SCREEN.FAILED', error: new Error('test') });
      expect(machine.lastError).toBeDefined();

      machine.reset();
      expect(machine.lastError).toBeUndefined();
    });

    it('игнорирует RESET в IDLE', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      machine.send({ type: 'PRESENTATION.RESET' });
      expect(machine.state).toBe(EState.IDLE);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[PresentationStateMachine] Invalid transition: PRESENTATION.RESET from presentation:idle',
        ),
      );

      consoleSpy.mockRestore();
    });

    it('игнорирует RESET в ACTIVE', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      machine.send({ type: 'SCREEN.STARTING' });
      machine.send({ type: 'SCREEN.STARTED' });
      machine.send({ type: 'PRESENTATION.RESET' });

      expect(machine.state).toBe(EState.ACTIVE);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[PresentationStateMachine] Invalid transition: PRESENTATION.RESET from presentation:active',
        ),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Полный жизненный цикл презентации', () => {
    it('успешный флоу: IDLE → STARTING → ACTIVE → STOPPING → IDLE', () => {
      expect(machine.state).toBe(EState.IDLE);

      machine.send({ type: 'SCREEN.STARTING' });
      expect(machine.state).toBe(EState.STARTING);

      machine.send({ type: 'SCREEN.STARTED' });
      expect(machine.state).toBe(EState.ACTIVE);

      machine.send({ type: 'SCREEN.ENDING' });
      expect(machine.state).toBe(EState.STOPPING);

      machine.send({ type: 'SCREEN.ENDED' });
      expect(machine.state).toBe(EState.IDLE);
    });

    it('обработка ошибки и retry: IDLE → STARTING → FAILED → reset → STARTING → ACTIVE', () => {
      machine.send({ type: 'SCREEN.STARTING' });
      machine.send({ type: 'SCREEN.FAILED', error: new Error('first attempt') });
      expect(machine.state).toBe(EState.FAILED);
      expect(machine.lastError).toBeDefined();

      machine.reset();
      expect(machine.state).toBe(EState.IDLE);
      expect(machine.lastError).toBeUndefined();

      machine.send({ type: 'SCREEN.STARTING' });
      expect(machine.state).toBe(EState.STARTING);

      machine.send({ type: 'SCREEN.STARTED' });
      expect(machine.state).toBe(EState.ACTIVE);
    });

    it('прерывание звонка во время активной презентации: ACTIVE + CALL.ENDED → IDLE', () => {
      machine.send({ type: 'SCREEN.STARTING' });
      machine.send({ type: 'SCREEN.STARTED' });
      expect(machine.state).toBe(EState.ACTIVE);

      machine.send({ type: 'CALL.ENDED' });
      expect(machine.state).toBe(EState.IDLE);
    });

    it('фейл звонка во время презентации: ACTIVE + CALL.FAILED → FAILED', () => {
      machine.send({ type: 'SCREEN.STARTING' });
      machine.send({ type: 'SCREEN.STARTED' });
      expect(machine.state).toBe(EState.ACTIVE);

      const callError = new Error('Call failed');

      machine.send({ type: 'CALL.FAILED', error: callError });
      expect(machine.state).toBe(EState.FAILED);
      expect(machine.lastError).toBe(callError);
    });
  });

  describe('Интеграция с событиями CallManager', () => {
    it('триггеры callEvents.trigger() корректно обрабатываются', () => {
      callEvents.trigger(ECallEvent.START_PRESENTATION, mediaStream);
      expect(machine.state).toBe(EState.STARTING);

      callEvents.trigger(ECallEvent.STARTED_PRESENTATION, mediaStream);
      expect(machine.state).toBe(EState.ACTIVE);

      callEvents.trigger(ECallEvent.END_PRESENTATION, mediaStream);
      expect(machine.state).toBe(EState.STOPPING);

      callEvents.trigger(ECallEvent.ENDED_PRESENTATION, mediaStream);
      expect(machine.state).toBe(EState.IDLE);
    });

    it('валидация работает через события CallManager', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Попытка перейти в ACTIVE напрямую из IDLE
      callEvents.trigger(ECallEvent.STARTED_PRESENTATION, mediaStream);

      expect(machine.state).toBe(EState.IDLE);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[PresentationStateMachine] Invalid transition'),
      );

      consoleSpy.mockRestore();
    });

    it('CALL.FAILED корректно обрабатывается в разных состояниях', () => {
      const error = {
        originator: 'remote',
        message: {},
        cause: 'error',
      };

      // STARTING → FAILED
      callEvents.trigger(ECallEvent.START_PRESENTATION, mediaStream);
      // @ts-expect-error
      callEvents.trigger(ECallEvent.FAILED, error);
      expect(machine.state).toBe(EState.FAILED);
      expect(machine.lastError).toEqual(new Error(JSON.stringify(error)));

      machine.reset();

      // ACTIVE → FAILED
      callEvents.trigger(ECallEvent.START_PRESENTATION, mediaStream);
      callEvents.trigger(ECallEvent.STARTED_PRESENTATION, mediaStream);
      // @ts-expect-error
      callEvents.trigger(ECallEvent.FAILED, error);
      expect(machine.state).toBe(EState.FAILED);

      machine.reset();

      // STOPPING → FAILED
      callEvents.trigger(ECallEvent.START_PRESENTATION, mediaStream);
      callEvents.trigger(ECallEvent.STARTED_PRESENTATION, mediaStream);
      callEvents.trigger(ECallEvent.END_PRESENTATION, mediaStream);
      // @ts-expect-error
      callEvents.trigger(ECallEvent.FAILED, error);
      expect(machine.state).toBe(EState.FAILED);
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
