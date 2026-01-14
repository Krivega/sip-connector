import { CallStateMachine, EState } from '../CallStateMachine';
import { createEvents } from '../events';

import type { TEventName, TEvents } from '../events';

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
        title: 'CALL.ACCEPTED из CONNECTING в ACCEPTED',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING' });
        },
        event: { type: 'CALL.ACCEPTED' },
        expected: EState.ACCEPTED,
      },
      {
        title: 'CALL.CONFIRMED из ACCEPTED в IN_CALL',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING' });
          machine.send({ type: 'CALL.ACCEPTED' });
        },
        event: { type: 'CALL.CONFIRMED' },
        expected: EState.IN_CALL,
      },
      {
        title: 'CALL.ENDED из IN_CALL в ENDED',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING' });
          machine.send({ type: 'CALL.ACCEPTED' });
          machine.send({ type: 'CALL.CONFIRMED' });
        },
        event: { type: 'CALL.ENDED' },
        expected: EState.ENDED,
      },
      {
        title: 'CALL.FAILED из IN_CALL в FAILED',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING' });
          machine.send({ type: 'CALL.ACCEPTED' });
          machine.send({ type: 'CALL.CONFIRMED' });
        },
        event: { type: 'CALL.FAILED', error: new Error('fail') },
        expected: EState.FAILED,
      },
      {
        title: 'CALL.CONNECTING из ENDED возвращает в CONNECTING',
        arrange: () => {
          machine.send({ type: 'CALL.CONNECTING' });
          machine.send({ type: 'CALL.ENDED' });
        },
        event: { type: 'CALL.CONNECTING' },
        expected: EState.CONNECTING,
      },
    ];

    it.each(transitions)('$title', ({ arrange, event, expected }) => {
      arrange?.();

      machine.send(event as never);

      expect(machine.state).toBe(expected);
    });
  });

  describe('Контракт адаптера событий менеджеров', () => {
    const scenarios: {
      title: string;
      steps: {
        event: TEventName;
        payload?: unknown;
        expected: EState;
      }[];
    }[] = [
      {
        title: 'успешный звонок (connecting → accepted → confirmed → ended)',
        steps: [
          { event: 'connecting', expected: EState.CONNECTING },
          { event: 'accepted', expected: EState.ACCEPTED },
          { event: 'confirmed', expected: EState.IN_CALL },
          { event: 'ended', expected: EState.ENDED },
        ],
      },
      {
        title: 'ошибка звонка (connecting → failed)',
        steps: [
          { event: 'connecting', expected: EState.CONNECTING },
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

    it.each(scenarios)('$title', ({ steps }) => {
      for (const step of steps) {
        events.trigger(step.event as never, step.payload as never);
        expect(machine.state).toBe(step.expected);
      }
    });
  });

  describe('Геттеры состояний', () => {
    it('isIdle должен возвращать true только для IDLE', () => {
      expect(machine.isIdle).toBe(true);
      machine.send({ type: 'CALL.CONNECTING' });
      expect(machine.isIdle).toBe(false);
    });

    it('isConnecting должен возвращать true только для CONNECTING', () => {
      expect(machine.isConnecting).toBe(false);
      machine.send({ type: 'CALL.CONNECTING' });
      expect(machine.isConnecting).toBe(true);
    });

    it('isAccepted должен возвращать true только для ACCEPTED', () => {
      expect(machine.isAccepted).toBe(false);
      machine.send({ type: 'CALL.CONNECTING' });
      machine.send({ type: 'CALL.ACCEPTED' });
      expect(machine.isAccepted).toBe(true);
    });

    it('isInCall должен возвращать true только для IN_CALL', () => {
      expect(machine.isInCall).toBe(false);
      machine.send({ type: 'CALL.CONNECTING' });
      machine.send({ type: 'CALL.CONFIRMED' });
      expect(machine.isInCall).toBe(true);
    });

    it('isEnded должен возвращать true только для ENDED', () => {
      expect(machine.isEnded).toBe(false);
      machine.send({ type: 'CALL.CONNECTING' });
      machine.send({ type: 'CALL.ENDED' });
      expect(machine.isEnded).toBe(true);
    });

    it('isFailed должен возвращать true только для FAILED', () => {
      expect(machine.isFailed).toBe(false);
      machine.send({ type: 'CALL.CONNECTING' });
      machine.send({ type: 'CALL.FAILED' });
      expect(machine.isFailed).toBe(true);
    });

    it('isPending должен возвращать true только для CONNECTING', () => {
      expect(machine.isPending).toBe(false);
      machine.send({ type: 'CALL.CONNECTING' });
      expect(machine.isPending).toBe(true);
      machine.send({ type: 'CALL.ACCEPTED' });
      expect(machine.isPending).toBe(false);
    });

    it('isActive должен возвращать true для ACCEPTED и IN_CALL', () => {
      expect(machine.isActive).toBe(false);
      machine.send({ type: 'CALL.CONNECTING' });
      machine.send({ type: 'CALL.ACCEPTED' });
      expect(machine.isActive).toBe(true);
      machine.send({ type: 'CALL.CONFIRMED' });
      expect(machine.isActive).toBe(true);
      machine.send({ type: 'CALL.ENDED' });
      expect(machine.isActive).toBe(false);
    });
  });

  describe('Обработка ошибок', () => {
    it('lastError должен быть undefined в начальном состоянии', () => {
      expect(machine.lastError).toBeUndefined();
    });

    it('lastError должен сохранять Error при CALL.FAILED', () => {
      const testError = new Error('Connection failed');

      machine.send({ type: 'CALL.CONNECTING' });
      machine.send({ type: 'CALL.FAILED', error: testError });

      expect(machine.state).toBe(EState.FAILED);
      expect(machine.lastError).toBe(testError);
      expect(machine.lastError?.message).toBe('Connection failed');
    });

    it('lastError должен конвертировать non-Error в Error', () => {
      machine.send({ type: 'CALL.CONNECTING' });
      machine.send({ type: 'CALL.FAILED', error: 'String error' });

      expect(machine.lastError).toBeInstanceOf(Error);
      expect(machine.lastError?.message).toBe('"String error"');
    });

    it('lastError должен быть undefined при CALL.FAILED без error', () => {
      machine.send({ type: 'CALL.CONNECTING' });
      machine.send({ type: 'CALL.FAILED' });

      expect(machine.state).toBe(EState.FAILED);
      expect(machine.lastError).toBeUndefined();
    });

    it('lastError должен очищаться при reset', () => {
      machine.send({ type: 'CALL.CONNECTING' });
      machine.send({ type: 'CALL.FAILED', error: new Error('Test') });
      expect(machine.lastError).toBeDefined();

      machine.reset();

      expect(machine.state).toBe(EState.IDLE);
      expect(machine.lastError).toBeUndefined();
    });

    it('lastError должен очищаться при новом звонке из FAILED', () => {
      machine.send({ type: 'CALL.CONNECTING' });
      machine.send({ type: 'CALL.FAILED', error: new Error('First error') });

      machine.send({ type: 'CALL.CONNECTING' });

      expect(machine.state).toBe(EState.CONNECTING);
      expect(machine.lastError).toBeUndefined();
    });
  });

  describe('Валидация переходов', () => {
    it('должен игнорировать недопустимые переходы с предупреждением', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Попытка перехода из IDLE в ACCEPTED (недопустимо)
      machine.send({ type: 'CALL.ACCEPTED' });

      expect(machine.state).toBe(EState.IDLE);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid transition: CALL.ACCEPTED from call:idle'),
      );

      consoleSpy.mockRestore();
    });

    it('должен игнорировать повторные CALL.CONNECTING в CONNECTING', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      machine.send({ type: 'CALL.CONNECTING' });
      expect(machine.state).toBe(EState.CONNECTING);

      machine.send({ type: 'CALL.CONNECTING' });

      expect(machine.state).toBe(EState.CONNECTING);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('должен запрещать переход CALL.CONFIRMED из CONNECTING', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      machine.send({ type: 'CALL.CONNECTING' });
      expect(machine.state).toBe(EState.CONNECTING);

      machine.send({ type: 'CALL.CONFIRMED' });

      expect(machine.state).toBe(EState.CONNECTING);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('должен запрещать прямой переход из ENDED в IN_CALL', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      machine.send({ type: 'CALL.CONNECTING' });
      machine.send({ type: 'CALL.ENDED' });
      expect(machine.state).toBe(EState.ENDED);

      machine.send({ type: 'CALL.CONFIRMED' });

      expect(machine.state).toBe(EState.ENDED);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('должен запрещать прямой переход из IDLE в IN_CALL', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      machine.send({ type: 'CALL.CONFIRMED' });

      expect(machine.state).toBe(EState.IDLE);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid transition: CALL.CONFIRMED from call:idle'),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Событие CALL.RESET', () => {
    it('должен переводить из FAILED в IDLE', () => {
      machine.send({ type: 'CALL.CONNECTING' });
      machine.send({ type: 'CALL.FAILED', error: new Error('Test') });
      expect(machine.state).toBe(EState.FAILED);

      machine.reset();

      expect(machine.state).toBe(EState.IDLE);
      expect(machine.lastError).toBeUndefined();
    });

    it('должен переводить из ENDED в IDLE', () => {
      machine.send({ type: 'CALL.CONNECTING' });
      machine.send({ type: 'CALL.ENDED' });
      expect(machine.state).toBe(EState.ENDED);

      machine.reset();

      expect(machine.state).toBe(EState.IDLE);
    });

    it('должен очищать ошибку при reset', () => {
      machine.send({ type: 'CALL.CONNECTING' });
      machine.send({ type: 'CALL.FAILED', error: new Error('Test error') });
      expect(machine.lastError).toBeDefined();

      machine.reset();

      expect(machine.lastError).toBeUndefined();
    });

    it('должен игнорировать CALL.RESET в неподходящих состояниях', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // В IDLE нельзя сделать RESET
      machine.send({ type: 'CALL.RESET' });
      expect(machine.state).toBe(EState.IDLE);

      // В CONNECTING нельзя сделать RESET
      machine.send({ type: 'CALL.CONNECTING' });
      machine.send({ type: 'CALL.RESET' });
      expect(machine.state).toBe(EState.CONNECTING);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Полный жизненный цикл звонка', () => {
    it('должен корректно проходить успешный звонок', () => {
      const states: EState[] = [];

      machine.subscribe((snapshot) => {
        states.push(snapshot.value as EState);
      });

      machine.send({ type: 'CALL.CONNECTING' });
      machine.send({ type: 'CALL.ACCEPTED' });
      machine.send({ type: 'CALL.CONFIRMED' });
      machine.send({ type: 'CALL.ENDED' });
      machine.reset();

      expect(states).toEqual([
        EState.CONNECTING,
        EState.ACCEPTED,
        EState.IN_CALL,
        EState.ENDED,
        EState.IDLE,
      ]);
    });

    it('должен корректно обрабатывать ошибку и повторный звонок', () => {
      machine.send({ type: 'CALL.CONNECTING' });
      machine.send({ type: 'CALL.FAILED', error: new Error('First attempt') });
      expect(machine.isFailed).toBe(true);
      expect(machine.lastError?.message).toBe('First attempt');

      // Повторная попытка
      machine.send({ type: 'CALL.CONNECTING' });
      expect(machine.isConnecting).toBe(true);
      expect(machine.lastError).toBeUndefined();

      machine.send({ type: 'CALL.ACCEPTED' });
      machine.send({ type: 'CALL.CONFIRMED' });
      expect(machine.isInCall).toBe(true);

      machine.send({ type: 'CALL.ENDED' });
      expect(machine.isEnded).toBe(true);
    });

    it('должен корректно проходить быстрый звонок', () => {
      const states: EState[] = [];

      machine.subscribe((snapshot) => {
        states.push(snapshot.value as EState);
      });

      machine.send({ type: 'CALL.CONNECTING' });
      machine.send({ type: 'CALL.ACCEPTED' });
      machine.send({ type: 'CALL.CONFIRMED' });
      machine.send({ type: 'CALL.ENDED' });

      expect(states).toEqual([EState.CONNECTING, EState.ACCEPTED, EState.IN_CALL, EState.ENDED]);
    });

    it('должен корректно обрабатывать раннее завершение звонка', () => {
      machine.send({ type: 'CALL.CONNECTING' });
      expect(machine.isConnecting).toBe(true);

      // Звонок завершился до принятия
      machine.send({ type: 'CALL.ENDED' });
      expect(machine.isEnded).toBe(true);

      // Можем начать новый звонок
      machine.send({ type: 'CALL.CONNECTING' });
      expect(machine.isConnecting).toBe(true);
    });
  });

  describe('Интеграция с событиями CallManager', () => {
    it('должен корректно реагировать на события через events', () => {
      events.trigger('connecting', undefined);
      expect(machine.state).toBe(EState.CONNECTING);

      events.trigger('accepted', undefined);
      expect(machine.state).toBe(EState.ACCEPTED);

      events.trigger('confirmed', undefined);
      expect(machine.state).toBe(EState.IN_CALL);

      events.trigger('ended', {} as never);
      expect(machine.state).toBe(EState.ENDED);
    });

    it('должен сохранять ошибку из события failed', () => {
      events.trigger('connecting', undefined);

      const error = new Error('Call failed');

      events.trigger('failed', error as never);

      expect(machine.state).toBe(EState.FAILED);
      expect(machine.lastError).toBe(error);
    });

    it('должен корректно обрабатывать события в правильном порядке', () => {
      // Проверяем полный flow через события
      events.trigger('connecting', undefined);
      expect(machine.isConnecting).toBe(true);

      events.trigger('accepted', undefined);
      expect(machine.isAccepted).toBe(true);

      events.trigger('confirmed', undefined);
      expect(machine.isInCall).toBe(true);

      events.trigger('ended', {} as never);
      expect(machine.isEnded).toBe(true);
    });

    it('должен игнорировать недопустимые события через валидацию', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Попытка accepted без connecting
      events.trigger('accepted', undefined);
      expect(machine.state).toBe(EState.IDLE);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
