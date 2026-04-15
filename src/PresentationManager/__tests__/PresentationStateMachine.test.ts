import { createMediaStreamMock } from 'webrtc-mock';

import { createLoggerMockModule } from '@/__fixtures__/logger.mock';
import { createEvents as createCallEvents } from '@/CallManager';
import resolveDebug from '@/logger';
import {
  PresentationStateMachine,
  EPresentationStatus,
  EPresentationStateMachineEvents,
} from '../PresentationStateMachine';

import type { TCallEvents } from '@/CallManager';

jest.mock('@/logger', () => {
  return createLoggerMockModule();
});

const mockDebug = (resolveDebug as jest.Mock).mock.results[0].value as jest.Mock;

describe('PresentationStateMachine', () => {
  let callEvents: TCallEvents;
  let machine: PresentationStateMachine;
  let mediaStream: MediaStream;

  const getContext = () => {
    return machine.getSnapshot().context as { lastError?: unknown };
  };

  beforeEach(() => {
    mockDebug.mockClear();
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
      expected: EPresentationStatus;
      expectedError?: unknown;
    }[] = [
      {
        title: 'SCREEN.STARTING из IDLE в STARTING и сброс ошибки',
        event: { type: EPresentationStateMachineEvents.SCREEN_STARTING },
        expected: EPresentationStatus.STARTING,
        expectedError: undefined,
      },
      {
        title: 'SCREEN.STARTED из STARTING в ACTIVE',
        arrange: () => {
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
        },
        event: { type: EPresentationStateMachineEvents.SCREEN_STARTED },
        expected: EPresentationStatus.ACTIVE,
      },
      {
        title: 'SCREEN.FAILED из STARTING в FAILED и запоминает ошибку',
        arrange: () => {
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
        },
        event: { type: EPresentationStateMachineEvents.SCREEN_FAILED, error: 'err-starting' },
        expected: EPresentationStatus.FAILED,
        expectedError: 'err-starting',
      },
      {
        title: 'SCREEN.ENDED из STARTING в IDLE со сбросом ошибки',
        arrange: () => {
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_FAILED, error: 'prev' });
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
        },
        event: { type: EPresentationStateMachineEvents.SCREEN_ENDED },
        expected: EPresentationStatus.IDLE,
        expectedError: undefined,
      },
      {
        title: 'CALL.FAILED из STARTING в FAILED и запоминает ошибку',
        arrange: () => {
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
        },
        event: { type: EPresentationStateMachineEvents.CALL_FAILED, error: 'call-failed-starting' },
        expected: EPresentationStatus.FAILED,
        expectedError: 'call-failed-starting',
      },
      {
        title: 'SCREEN.ENDING из ACTIVE в STOPPING',
        arrange: () => {
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });
        },
        event: { type: EPresentationStateMachineEvents.SCREEN_ENDING },
        expected: EPresentationStatus.STOPPING,
      },
      {
        title: 'SCREEN.ENDED из ACTIVE в IDLE',
        arrange: () => {
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });
        },
        event: { type: EPresentationStateMachineEvents.SCREEN_ENDED },
        expected: EPresentationStatus.IDLE,
      },
      {
        title: 'SCREEN.FAILED из ACTIVE в FAILED и запоминает ошибку',
        arrange: () => {
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });
        },
        event: { type: EPresentationStateMachineEvents.SCREEN_FAILED, error: 'active-fail' },
        expected: EPresentationStatus.FAILED,
        expectedError: 'active-fail',
      },
      {
        title: 'SCREEN.FAILED из ACTIVE без error оставляет lastError undefined',
        arrange: () => {
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });
        },
        event: { type: EPresentationStateMachineEvents.SCREEN_FAILED },
        expected: EPresentationStatus.FAILED,
        expectedError: undefined,
      },
      {
        title: 'CALL.ENDED из ACTIVE в IDLE',
        arrange: () => {
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });
        },
        event: { type: EPresentationStateMachineEvents.CALL_ENDED },
        expected: EPresentationStatus.IDLE,
      },
      {
        title: 'CALL.FAILED из ACTIVE в FAILED и запоминает ошибку',
        arrange: () => {
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });
        },
        event: { type: EPresentationStateMachineEvents.CALL_FAILED, error: 'call-fail' },
        expected: EPresentationStatus.FAILED,
        expectedError: 'call-fail',
      },
      {
        title: 'SCREEN.ENDED из STOPPING в IDLE',
        arrange: () => {
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_ENDING });
        },
        event: { type: EPresentationStateMachineEvents.SCREEN_ENDED },
        expected: EPresentationStatus.IDLE,
      },
      {
        title: 'SCREEN.FAILED из STOPPING в FAILED и запоминает ошибку',
        arrange: () => {
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_ENDING });
        },
        event: { type: EPresentationStateMachineEvents.SCREEN_FAILED, error: 'stop-fail' },
        expected: EPresentationStatus.FAILED,
        expectedError: 'stop-fail',
      },
      {
        title: 'CALL.ENDED из STOPPING в IDLE',
        arrange: () => {
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_ENDING });
        },
        event: { type: EPresentationStateMachineEvents.CALL_ENDED },
        expected: EPresentationStatus.IDLE,
      },
      {
        title: 'CALL.FAILED из STOPPING в FAILED и запоминает ошибку',
        arrange: () => {
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_ENDING });
        },
        event: { type: EPresentationStateMachineEvents.CALL_FAILED, error: 'call-failed-stopping' },
        expected: EPresentationStatus.FAILED,
        expectedError: 'call-failed-stopping',
      },
      {
        title: 'SCREEN.STARTING из FAILED в STARTING сбрасывает ошибку',
        arrange: () => {
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_FAILED, error: 'old-error' });
        },
        event: { type: EPresentationStateMachineEvents.SCREEN_STARTING },
        expected: EPresentationStatus.STARTING,
        expectedError: undefined,
      },
      {
        title: 'SCREEN.ENDED из FAILED в IDLE сбрасывает ошибку',
        arrange: () => {
          machine.send({ type: EPresentationStateMachineEvents.SCREEN_FAILED, error: 'old-error' });
        },
        event: { type: EPresentationStateMachineEvents.SCREEN_ENDED },
        expected: EPresentationStatus.IDLE,
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
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      expect(machine.isIdle).toBe(false);
      expect(machine.isStarting).toBe(true);
      expect(machine.isActive).toBe(false);
      expect(machine.isStopping).toBe(false);
      expect(machine.isFailed).toBe(false);
    });

    it('isActive возвращает true только в ACTIVE', () => {
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });
      expect(machine.isIdle).toBe(false);
      expect(machine.isStarting).toBe(false);
      expect(machine.isActive).toBe(true);
      expect(machine.isStopping).toBe(false);
      expect(machine.isFailed).toBe(false);
    });

    it('isStopping возвращает true только в STOPPING', () => {
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_ENDING });
      expect(machine.isIdle).toBe(false);
      expect(machine.isStarting).toBe(false);
      expect(machine.isActive).toBe(false);
      expect(machine.isStopping).toBe(true);
      expect(machine.isFailed).toBe(false);
    });

    it('isFailed возвращает true только в FAILED', () => {
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      machine.send({
        type: EPresentationStateMachineEvents.SCREEN_FAILED,
        error: new Error('test'),
      });
      expect(machine.isIdle).toBe(false);
      expect(machine.isStarting).toBe(false);
      expect(machine.isActive).toBe(false);
      expect(machine.isStopping).toBe(false);
      expect(machine.isFailed).toBe(true);
    });

    it('isPending возвращает true для STARTING и STOPPING', () => {
      expect(machine.isPending).toBe(false);

      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      expect(machine.isPending).toBe(true);

      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });
      expect(machine.isPending).toBe(false);

      machine.send({ type: EPresentationStateMachineEvents.SCREEN_ENDING });
      expect(machine.isPending).toBe(true);

      machine.send({ type: EPresentationStateMachineEvents.SCREEN_ENDED });
      expect(machine.isPending).toBe(false);
    });

    it('isActiveOrPending возвращает true для STARTING, ACTIVE и STOPPING', () => {
      expect(machine.isActiveOrPending).toBe(false);

      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      expect(machine.isActiveOrPending).toBe(true);

      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });
      expect(machine.isActiveOrPending).toBe(true);

      machine.send({ type: EPresentationStateMachineEvents.SCREEN_ENDING });
      expect(machine.isActiveOrPending).toBe(true);

      machine.send({ type: EPresentationStateMachineEvents.SCREEN_ENDED });
      expect(machine.isActiveOrPending).toBe(false);
    });
  });

  describe('Обработка ошибок', () => {
    it('lastError изначально undefined', () => {
      expect(machine.lastError).toBeUndefined();
    });

    it('сохраняет Error объект', () => {
      const error = new Error('test error');

      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_FAILED, error });

      expect(machine.lastError).toBe(error);
      expect(machine.lastError?.message).toBe('test error');
    });

    it('конвертирует строку в Error', () => {
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_FAILED, error: 'String error' });

      expect(machine.lastError).toBeInstanceOf(Error);
      expect(machine.lastError?.message).toBe('"String error"');
    });

    it('конвертирует объект в Error', () => {
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      machine.send({
        type: EPresentationStateMachineEvents.SCREEN_FAILED,
        error: { code: 500, message: 'Server error' },
      });

      expect(machine.lastError).toBeInstanceOf(Error);
      expect(machine.lastError?.message).toContain('500');
      expect(machine.lastError?.message).toContain('Server error');
    });

    it('lastError undefined когда error не передан', () => {
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_FAILED });

      expect(machine.lastError).toBeUndefined();
    });

    it('очищает lastError при reset', () => {
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      machine.send({
        type: EPresentationStateMachineEvents.SCREEN_FAILED,
        error: new Error('test'),
      });
      expect(machine.lastError).toBeDefined();

      machine.reset();
      expect(machine.lastError).toBeUndefined();
      expect(machine.state).toBe(EPresentationStatus.IDLE);
    });

    it('очищает lastError при новой попытке запуска', () => {
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      machine.send({
        type: EPresentationStateMachineEvents.SCREEN_FAILED,
        error: new Error('first error'),
      });
      expect(machine.lastError).toBeDefined();

      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      expect(machine.lastError).toBeUndefined();
      expect(machine.state).toBe(EPresentationStatus.STARTING);
    });
  });

  describe('Валидация переходов', () => {
    it('предупреждает при попытке IDLE → ACTIVE', () => {
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });

      expect(machine.state).toBe(EPresentationStatus.IDLE);
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining(
          '[PresentationStateMachine] Invalid transition: SCREEN.STARTED from presentation:idle',
        ),
      );
    });

    it('предупреждает при попытке STARTING → STOPPING', () => {
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_ENDING });

      expect(machine.state).toBe(EPresentationStatus.STARTING);
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining(
          '[PresentationStateMachine] Invalid transition: SCREEN.ENDING from presentation:starting',
        ),
      );
    });

    it('предупреждает при повторном SCREEN.STARTING из STARTING', () => {
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });

      expect(machine.state).toBe(EPresentationStatus.STARTING);
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining(
          '[PresentationStateMachine] Invalid transition: SCREEN.STARTING from presentation:starting',
        ),
      );
    });

    it('предупреждает при ACTIVE → STARTING', () => {
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });

      expect(machine.state).toBe(EPresentationStatus.ACTIVE);
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining(
          '[PresentationStateMachine] Invalid transition: SCREEN.STARTING from presentation:active',
        ),
      );
    });

    it('не предупреждает при допустимых переходах', () => {
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_ENDING });
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_ENDED });

      expect(mockDebug).not.toHaveBeenCalledWith(expect.stringContaining('Invalid transition:'));
    });
  });

  describe('Событие PRESENTATION.RESET', () => {
    it('переводит из FAILED в IDLE через reset()', () => {
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      machine.send({
        type: EPresentationStateMachineEvents.SCREEN_FAILED,
        error: new Error('test'),
      });
      expect(machine.state).toBe(EPresentationStatus.FAILED);

      machine.reset();
      expect(machine.state).toBe(EPresentationStatus.IDLE);
    });

    it('очищает lastError при reset', () => {
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      machine.send({
        type: EPresentationStateMachineEvents.SCREEN_FAILED,
        error: new Error('test'),
      });
      expect(machine.lastError).toBeDefined();

      machine.reset();
      expect(machine.lastError).toBeUndefined();
    });

    it('игнорирует RESET в IDLE', () => {
      machine.send({ type: EPresentationStateMachineEvents.PRESENTATION_RESET });
      expect(machine.state).toBe(EPresentationStatus.IDLE);
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining(
          '[PresentationStateMachine] Invalid transition: PRESENTATION.RESET from presentation:idle',
        ),
      );
    });

    it('игнорирует RESET в ACTIVE', () => {
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });
      machine.send({ type: EPresentationStateMachineEvents.PRESENTATION_RESET });

      expect(machine.state).toBe(EPresentationStatus.ACTIVE);
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining(
          '[PresentationStateMachine] Invalid transition: PRESENTATION.RESET from presentation:active',
        ),
      );
    });
  });

  describe('Полный жизненный цикл презентации', () => {
    it('успешный флоу: IDLE → STARTING → ACTIVE → STOPPING → IDLE', () => {
      expect(machine.state).toBe(EPresentationStatus.IDLE);

      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      expect(machine.state).toBe(EPresentationStatus.STARTING);

      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });
      expect(machine.state).toBe(EPresentationStatus.ACTIVE);

      machine.send({ type: EPresentationStateMachineEvents.SCREEN_ENDING });
      expect(machine.state).toBe(EPresentationStatus.STOPPING);

      machine.send({ type: EPresentationStateMachineEvents.SCREEN_ENDED });
      expect(machine.state).toBe(EPresentationStatus.IDLE);
    });

    it('обработка ошибки и retry: IDLE → STARTING → FAILED → reset → STARTING → ACTIVE', () => {
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      machine.send({
        type: EPresentationStateMachineEvents.SCREEN_FAILED,
        error: new Error('first attempt'),
      });
      expect(machine.state).toBe(EPresentationStatus.FAILED);
      expect(machine.lastError).toBeDefined();

      machine.reset();
      expect(machine.state).toBe(EPresentationStatus.IDLE);
      expect(machine.lastError).toBeUndefined();

      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      expect(machine.state).toBe(EPresentationStatus.STARTING);

      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });
      expect(machine.state).toBe(EPresentationStatus.ACTIVE);
    });

    it('прерывание звонка во время активной презентации: ACTIVE + CALL.ENDED → IDLE', () => {
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });
      expect(machine.state).toBe(EPresentationStatus.ACTIVE);

      machine.send({ type: EPresentationStateMachineEvents.CALL_ENDED });
      expect(machine.state).toBe(EPresentationStatus.IDLE);
    });

    it('фейл звонка во время презентации: ACTIVE + CALL.FAILED → FAILED', () => {
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTING });
      machine.send({ type: EPresentationStateMachineEvents.SCREEN_STARTED });
      expect(machine.state).toBe(EPresentationStatus.ACTIVE);

      const callError = new Error('Call failed');

      machine.send({ type: EPresentationStateMachineEvents.CALL_FAILED, error: callError });
      expect(machine.state).toBe(EPresentationStatus.FAILED);
      expect(machine.lastError).toBe(callError);
    });
  });

  describe('Интеграция с событиями CallManager', () => {
    it('триггеры callEvents.trigger() корректно обрабатываются', () => {
      callEvents.trigger('presentation:start', mediaStream);
      expect(machine.state).toBe(EPresentationStatus.STARTING);

      callEvents.trigger('presentation:started', mediaStream);
      expect(machine.state).toBe(EPresentationStatus.ACTIVE);

      callEvents.trigger('presentation:end', mediaStream);
      expect(machine.state).toBe(EPresentationStatus.STOPPING);

      callEvents.trigger('presentation:ended', mediaStream);
      expect(machine.state).toBe(EPresentationStatus.IDLE);
    });

    it('валидация работает через события CallManager', () => {
      // Попытка перейти в ACTIVE напрямую из IDLE
      callEvents.trigger('presentation:started', mediaStream);

      expect(machine.state).toBe(EPresentationStatus.IDLE);
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining('[PresentationStateMachine] Invalid transition'),
      );
    });

    it('CALL.FAILED корректно обрабатывается в разных состояниях', () => {
      const error = {
        originator: 'remote',
        message: {},
        cause: 'error',
      };

      // STARTING → FAILED
      callEvents.trigger('presentation:start', mediaStream);
      // @ts-expect-error
      callEvents.trigger('presentation:failed', error);
      expect(machine.state).toBe(EPresentationStatus.FAILED);
      expect(machine.lastError).toEqual(new Error(JSON.stringify(error)));

      machine.reset();

      // ACTIVE → FAILED
      callEvents.trigger('presentation:start', mediaStream);
      callEvents.trigger('presentation:started', mediaStream);
      // @ts-expect-error
      callEvents.trigger('presentation:failed', error);
      expect(machine.state).toBe(EPresentationStatus.FAILED);

      machine.reset();

      // STOPPING → FAILED
      callEvents.trigger('presentation:start', mediaStream);
      callEvents.trigger('presentation:started', mediaStream);
      callEvents.trigger('presentation:end', mediaStream);
      // @ts-expect-error
      callEvents.trigger('presentation:failed', error);
      expect(machine.state).toBe(EPresentationStatus.FAILED);
    });
  });

  describe('Контракт адаптера событий менеджеров', () => {
    it('обрабатывает цепочку событий от менеджеров', () => {
      // start sharing
      callEvents.trigger('presentation:start', mediaStream);
      expect(machine.state).toBe(EPresentationStatus.STARTING);
      expect(getContext().lastError).toBeUndefined();

      // started
      callEvents.trigger('presentation:started', mediaStream);
      expect(machine.state).toBe(EPresentationStatus.ACTIVE);

      // end request
      callEvents.trigger('presentation:end', mediaStream);
      expect(machine.state).toBe(EPresentationStatus.STOPPING);

      // ended -> idle
      callEvents.trigger('presentation:ended', mediaStream);
      expect(machine.state).toBe(EPresentationStatus.IDLE);

      // new start and failure from call
      callEvents.trigger('presentation:start', mediaStream);
      callEvents.trigger('presentation:started', mediaStream);
      callEvents.trigger('presentation:failed', new Error('call failed'));
      expect(machine.state).toBe(EPresentationStatus.FAILED);
      expect(getContext().lastError).toBeInstanceOf(Error);
    });
  });
});
