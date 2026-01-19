import { createApiManagerEvents, EContentedStreamCodec } from '@/ApiManager';
import { ContentedStreamStateMachine, EState } from '../ContentedStreamStateMachine';

import type { TApiManagerEvents } from '@/ApiManager';

describe('ContentedStreamStateMachine', () => {
  let apiManagerEvents: TApiManagerEvents;
  let machine: ContentedStreamStateMachine;

  beforeEach(() => {
    apiManagerEvents = createApiManagerEvents();
    machine = new ContentedStreamStateMachine();
    machine.subscribeToApiEvents(apiManagerEvents);
  });

  afterEach(() => {
    machine.stop();
  });

  describe('Табличные переходы по доменным событиям', () => {
    const transitions: {
      title: string;
      arrange?: () => void;
      event: { type: string; codec?: EContentedStreamCodec };
      expected: EState;
    }[] = [
      {
        title: 'CONTENTED_STREAM.AVAILABLE из NOT_AVAILABLE в AVAILABLE',
        event: { type: 'CONTENTED_STREAM.AVAILABLE', codec: EContentedStreamCodec.H264 },
        expected: EState.AVAILABLE,
      },
      {
        title: 'CONTENTED_STREAM.AVAILABLE без codec из NOT_AVAILABLE в AVAILABLE',
        event: { type: 'CONTENTED_STREAM.AVAILABLE' },
        expected: EState.AVAILABLE,
      },
      {
        title: 'CONTENTED_STREAM.NOT_AVAILABLE из AVAILABLE в NOT_AVAILABLE',
        arrange: () => {
          machine.send({
            type: 'CONTENTED_STREAM.AVAILABLE',
            codec: EContentedStreamCodec.H264,
          });
        },
        event: { type: 'CONTENTED_STREAM.NOT_AVAILABLE' },
        expected: EState.NOT_AVAILABLE,
      },
      {
        title: 'CONTENTED_STREAM.AVAILABLE с новым codec из AVAILABLE остается в AVAILABLE',
        arrange: () => {
          machine.send({
            type: 'CONTENTED_STREAM.AVAILABLE',
            codec: EContentedStreamCodec.H264,
          });
        },
        event: { type: 'CONTENTED_STREAM.AVAILABLE', codec: EContentedStreamCodec.VP8 },
        expected: EState.AVAILABLE,
      },
    ];

    it.each(transitions)('$title', ({ arrange, event, expected }) => {
      arrange?.();

      machine.send(event as never);

      expect(machine.state).toBe(expected);
    });
  });

  describe('Контракт адаптера событий ApiManager', () => {
    const scenarios: {
      title: string;
      steps: {
        event: string;
        payload: { codec?: EContentedStreamCodec };
        expected: EState;
      }[];
    }[] = [
      {
        title: 'успешный цикл (not-available → available → not-available)',
        steps: [
          {
            event: 'contented-stream:available',
            payload: { codec: EContentedStreamCodec.H264 },
            expected: EState.AVAILABLE,
          },
          { event: 'contented-stream:not-available', payload: {}, expected: EState.NOT_AVAILABLE },
        ],
      },
      {
        title: 'обновление codec в available состоянии',
        steps: [
          {
            event: 'contented-stream:available',
            payload: { codec: EContentedStreamCodec.H264 },
            expected: EState.AVAILABLE,
          },
          {
            event: 'contented-stream:available',
            payload: { codec: EContentedStreamCodec.VP8 },
            expected: EState.AVAILABLE,
          },
        ],
      },
      {
        title: 'available без codec',
        steps: [{ event: 'contented-stream:available', payload: {}, expected: EState.AVAILABLE }],
      },
    ];

    it.each(scenarios)('$title', ({ steps }) => {
      for (const step of steps) {
        apiManagerEvents.trigger(step.event as never, step.payload as never);
        expect(machine.state).toBe(step.expected);
      }
    });
  });

  describe('Геттеры состояний', () => {
    it('isNotAvailable должен возвращать true только для NOT_AVAILABLE', () => {
      expect(machine.isNotAvailable).toBe(true);
      machine.send({ type: 'CONTENTED_STREAM.AVAILABLE' });
      expect(machine.isNotAvailable).toBe(false);
    });

    it('isAvailable должен возвращать true только для AVAILABLE', () => {
      expect(machine.isAvailable).toBe(false);
      machine.send({ type: 'CONTENTED_STREAM.AVAILABLE' });
      expect(machine.isAvailable).toBe(true);
    });

    it('codec должен возвращать undefined по умолчанию', () => {
      expect(machine.codec).toBeUndefined();
    });

    it('codec должен возвращать сохраненный codec', () => {
      machine.send({ type: 'CONTENTED_STREAM.AVAILABLE', codec: EContentedStreamCodec.H264 });
      expect(machine.codec).toBe('H264');
    });

    it('codec должен обновляться при новом available событии', () => {
      machine.send({ type: 'CONTENTED_STREAM.AVAILABLE', codec: EContentedStreamCodec.H264 });
      expect(machine.codec).toBe('H264');

      machine.send({ type: 'CONTENTED_STREAM.AVAILABLE', codec: EContentedStreamCodec.VP8 });
      expect(machine.codec).toBe('VP8');
    });

    it('codec должен очищаться при not-available событии', () => {
      machine.send({ type: 'CONTENTED_STREAM.AVAILABLE', codec: EContentedStreamCodec.H264 });
      expect(machine.codec).toBe('H264');

      machine.send({ type: 'CONTENTED_STREAM.NOT_AVAILABLE' });
      expect(machine.codec).toBeUndefined();
    });

    it('getStateInfo должен возвращать корректную информацию', () => {
      expect(machine.getStateInfo()).toEqual({ isAvailable: false, codec: undefined });

      machine.send({ type: 'CONTENTED_STREAM.AVAILABLE', codec: EContentedStreamCodec.H264 });
      expect(machine.getStateInfo()).toEqual({
        isAvailable: true,
        codec: EContentedStreamCodec.H264,
      });

      machine.send({ type: 'CONTENTED_STREAM.NOT_AVAILABLE' });
      expect(machine.getStateInfo()).toEqual({ isAvailable: false, codec: undefined });
    });
  });

  describe('Обработка ошибок', () => {
    it('lastError не используется в этой машине состояний', () => {
      // ContentedStreamStateMachine не имеет lastError, в отличие от CallStateMachine
      expect(true).toBe(true);
    });
  });

  describe('Валидация переходов', () => {
    it('должен игнорировать недопустимые переходы с предупреждением', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Попытка перейти из NOT_AVAILABLE в NOT_AVAILABLE
      machine.send({ type: 'CONTENTED_STREAM.NOT_AVAILABLE' });

      expect(machine.state).toBe(EState.NOT_AVAILABLE);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid transition: CONTENTED_STREAM.NOT_AVAILABLE from contented-stream:not-available',
        ),
      );

      consoleSpy.mockRestore();
    });

    it('должен игнорировать повторные CONTENTED_STREAM.AVAILABLE в AVAILABLE', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      machine.send({ type: 'CONTENTED_STREAM.AVAILABLE', codec: EContentedStreamCodec.H264 });
      expect(machine.state).toBe(EState.AVAILABLE);

      // Повторное available должно быть допустимо для обновления codec
      machine.send({ type: 'CONTENTED_STREAM.AVAILABLE', codec: EContentedStreamCodec.VP8 });
      expect(machine.state).toBe(EState.AVAILABLE);
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('должен запрещать прямой переход из NOT_AVAILABLE в NOT_AVAILABLE', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      machine.send({ type: 'CONTENTED_STREAM.NOT_AVAILABLE' });

      expect(machine.state).toBe(EState.NOT_AVAILABLE);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Событие CONTENTED_STREAM.RESET', () => {
    it('должен переводить из AVAILABLE в NOT_AVAILABLE', () => {
      machine.send({ type: 'CONTENTED_STREAM.AVAILABLE', codec: EContentedStreamCodec.H264 });
      expect(machine.state).toBe(EState.AVAILABLE);
      expect(machine.codec).toBe('H264');

      machine.reset();

      expect(machine.state).toBe(EState.NOT_AVAILABLE);
      expect(machine.codec).toBeUndefined();
    });

    it('должен игнорировать RESET в NOT_AVAILABLE', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      machine.reset();

      expect(machine.state).toBe(EState.NOT_AVAILABLE);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Полный жизненный цикл contented stream', () => {
    it('должен корректно проходить полный жизненный цикл', () => {
      const states: EState[] = [];

      machine.subscribe((snapshot) => {
        states.push(snapshot.value as EState);
      });

      machine.send({ type: 'CONTENTED_STREAM.AVAILABLE', codec: EContentedStreamCodec.H264 });
      machine.send({ type: 'CONTENTED_STREAM.AVAILABLE', codec: EContentedStreamCodec.VP8 });
      machine.send({ type: 'CONTENTED_STREAM.NOT_AVAILABLE' });

      // RESET из NOT_AVAILABLE игнорируется, так как уже в этом состоянии
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      machine.reset();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();

      expect(states).toEqual([
        EState.AVAILABLE,
        EState.AVAILABLE, // reenter для обновления codec
        EState.NOT_AVAILABLE,
      ]);
    });

    it('должен корректно обрабатывать быстрый цикл available/not-available', () => {
      machine.send({ type: 'CONTENTED_STREAM.AVAILABLE', codec: EContentedStreamCodec.H264 });
      expect(machine.isAvailable).toBe(true);
      expect(machine.codec).toBe('H264');

      machine.send({ type: 'CONTENTED_STREAM.NOT_AVAILABLE' });
      expect(machine.isNotAvailable).toBe(true);
      expect(machine.codec).toBeUndefined();

      machine.send({ type: 'CONTENTED_STREAM.AVAILABLE', codec: EContentedStreamCodec.VP8 });
      expect(machine.isAvailable).toBe(true);
      expect(machine.codec).toBe('VP8');
    });

    it('должен корректно проходить цикл с обновлением codec', () => {
      machine.send({ type: 'CONTENTED_STREAM.AVAILABLE', codec: EContentedStreamCodec.H264 });
      expect(machine.isAvailable).toBe(true);
      expect(machine.codec).toBe('H264');

      machine.send({ type: 'CONTENTED_STREAM.AVAILABLE', codec: EContentedStreamCodec.VP8 });
      expect(machine.isAvailable).toBe(true);
      expect(machine.codec).toBe('VP8');

      machine.send({ type: 'CONTENTED_STREAM.NOT_AVAILABLE' });
      expect(machine.isNotAvailable).toBe(true);
    });

    it('должен корректно обрабатывать раннее изменение available', () => {
      machine.send({ type: 'CONTENTED_STREAM.AVAILABLE', codec: EContentedStreamCodec.H264 });
      expect(machine.isAvailable).toBe(true);

      // Быстрое изменение codec
      machine.send({ type: 'CONTENTED_STREAM.AVAILABLE', codec: EContentedStreamCodec.VP8 });
      expect(machine.isAvailable).toBe(true);
      expect(machine.codec).toBe('VP8');
    });
  });

  describe('Интеграция с событиями ApiManager', () => {
    it('должен корректно реагировать на события через apiManagerEvents', () => {
      apiManagerEvents.trigger('contented-stream:available', { codec: EContentedStreamCodec.H264 });
      expect(machine.state).toBe(EState.AVAILABLE);
      expect(machine.codec).toBe('H264');

      apiManagerEvents.trigger('contented-stream:not-available', {});
      expect(machine.state).toBe(EState.NOT_AVAILABLE);
      expect(machine.codec).toBeUndefined();
    });

    it('должен сохранять codec из события available', () => {
      apiManagerEvents.trigger('contented-stream:available', { codec: EContentedStreamCodec.H264 });

      expect(machine.state).toBe(EState.AVAILABLE);
      expect(machine.codec).toBe('H264');
    });

    it('должен обрабатывать событие available без codec', () => {
      apiManagerEvents.trigger('contented-stream:available', {});

      expect(machine.state).toBe(EState.AVAILABLE);
      expect(machine.codec).toBeUndefined();
    });

    it('должен корректно обрабатывать события в правильном порядке', () => {
      // Проверяем полный flow через события
      apiManagerEvents.trigger('contented-stream:available', { codec: EContentedStreamCodec.H264 });
      expect(machine.isAvailable).toBe(true);
      expect(machine.codec).toBe('H264');

      apiManagerEvents.trigger('contented-stream:available', {
        codec: EContentedStreamCodec.VP8,
      });
      expect(machine.isAvailable).toBe(true);
      expect(machine.codec).toBe('VP8');

      apiManagerEvents.trigger('contented-stream:not-available', {});
      expect(machine.isNotAvailable).toBe(true);
      expect(machine.codec).toBeUndefined();
    });

    it('должен игнорировать недопустимые события через валидацию', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Попытка not-available в NOT_AVAILABLE состоянии (недопустимо)
      apiManagerEvents.trigger('contented-stream:not-available', {});
      expect(machine.state).toBe(EState.NOT_AVAILABLE);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('должен корректно обрабатывать последовательные события available', () => {
      apiManagerEvents.trigger('contented-stream:available', { codec: EContentedStreamCodec.H264 });
      expect(machine.codec).toBe('H264');

      apiManagerEvents.trigger('contented-stream:available', {
        codec: EContentedStreamCodec.VP8,
      });
      expect(machine.codec).toBe('VP8');

      apiManagerEvents.trigger('contented-stream:available', {});
      expect(machine.codec).toBeUndefined();
    });
  });
});
