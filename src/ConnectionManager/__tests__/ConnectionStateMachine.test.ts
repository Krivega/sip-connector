import logger from '@/logger';
import ConnectionStateMachine, { EEvents, EState } from '../ConnectionStateMachine';
import { createEvents } from '../events';

import type { Socket, IncomingResponse } from '@krivega/jssip';
import type { TEvents } from '../events';

jest.mock('@/logger', () => {
  return jest.fn();
});

describe('ConnectionStateMachine', () => {
  const mockLogger = logger as jest.MockedFunction<typeof logger>;
  let events: TEvents;
  let stateMachine: ConnectionStateMachine;

  beforeEach(() => {
    jest.clearAllMocks();
    events = createEvents();
    stateMachine = new ConnectionStateMachine(events);
  });

  afterEach(() => {
    stateMachine.destroy();
  });

  describe('Инициализация', () => {
    it('должен инициализироваться с состоянием IDLE', () => {
      expect(stateMachine.state).toBe(EState.IDLE);
      expect(stateMachine.isIdle).toBe(true);
      expect(stateMachine.isPending).toBe(false);
    });

    it('должен подписаться на события UA при создании', () => {
      const spyOn = jest.spyOn(events, 'on');

      // Создаем новую stateMachine для проверки подписки
      const newStateMachine = new ConnectionStateMachine(events);

      expect(spyOn).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(spyOn).toHaveBeenCalledWith('registered', expect.any(Function));
      expect(spyOn).toHaveBeenCalledWith('unregistered', expect.any(Function));
      expect(spyOn).toHaveBeenCalledWith('disconnected', expect.any(Function));
      expect(spyOn).toHaveBeenCalledWith('registrationFailed', expect.any(Function));
      expect(spyOn).toHaveBeenCalledWith('connect-failed', expect.any(Function));

      newStateMachine.destroy();
    });

    it('должен логировать изменения состояний', () => {
      // Очищаем предыдущие вызовы
      mockLogger.mockClear();

      stateMachine.startConnect();

      expect(mockLogger).toHaveBeenCalledWith(
        'State transition: connection:idle -> connection:preparing (START_CONNECT)',
      );
    });
  });

  describe('Геттеры состояний', () => {
    it('isIdle должен возвращать true только для IDLE', () => {
      expect(stateMachine.isIdle).toBe(true);
      stateMachine.startConnect();
      expect(stateMachine.isIdle).toBe(false);
    });

    it('isPreparing должен возвращать true только для PREPARING', () => {
      expect(stateMachine.isPreparing).toBe(false);
      stateMachine.startConnect();
      expect(stateMachine.isPreparing).toBe(true);
    });

    it('isConnecting должен возвращать true только для CONNECTING', () => {
      stateMachine.startConnect();
      expect(stateMachine.isConnecting).toBe(false);
      stateMachine.startInitUa();
      expect(stateMachine.isConnecting).toBe(true);
    });

    it('isPending должен возвращать true для PREPARING и CONNECTING', () => {
      expect(stateMachine.isPending).toBe(false);

      stateMachine.startConnect();
      expect(stateMachine.isPending).toBe(true);
      expect(stateMachine.isPendingConnect).toBe(true);
      expect(stateMachine.isPendingInitUa).toBe(false);

      stateMachine.startInitUa();
      expect(stateMachine.isPending).toBe(true);
      expect(stateMachine.isPendingConnect).toBe(false);
      expect(stateMachine.isPendingInitUa).toBe(true);
    });

    it('isActiveConnection должен возвращать true для CONNECTED, REGISTERED и ESTABLISHED', () => {
      expect(stateMachine.isActiveConnection).toBe(false);

      // Переводим в состояние CONNECTED (автоматически переходит в ESTABLISHED)
      stateMachine.startConnect();
      stateMachine.startInitUa();
      events.trigger('connected', { socket: {} as Socket });
      expect(stateMachine.isActiveConnection).toBe(true);
      expect(stateMachine.isEstablished).toBe(true);

      // Переводим в состояние REGISTERED (автоматически переходит в ESTABLISHED)
      stateMachine.reset();
      stateMachine.startConnect();
      stateMachine.startInitUa();
      events.trigger('registered', { response: {} as IncomingResponse });
      expect(stateMachine.isActiveConnection).toBe(true);
      expect(stateMachine.isEstablished).toBe(true);
    });

    it('isEstablished должен возвращать true только для ESTABLISHED', () => {
      expect(stateMachine.isEstablished).toBe(false);

      // Переводим в состояние CONNECTED (автоматически переходит в ESTABLISHED)
      stateMachine.startConnect();
      stateMachine.startInitUa();
      events.trigger('connected', { socket: {} as Socket });
      expect(stateMachine.isEstablished).toBe(true);

      // Переводим в состояние REGISTERED (автоматически переходит в ESTABLISHED)
      stateMachine.reset();
      stateMachine.startConnect();
      stateMachine.startInitUa();
      events.trigger('registered', { response: {} as IncomingResponse });
      expect(stateMachine.isEstablished).toBe(true);
    });
  });

  describe('Публичные методы переходов', () => {
    it('startConnect должен переводить из IDLE в PREPARING', () => {
      expect(stateMachine.state).toBe(EState.IDLE);

      stateMachine.startConnect();

      expect(stateMachine.state).toBe(EState.PREPARING);
      expect(mockLogger).toHaveBeenCalledWith(
        'State transition: connection:idle -> connection:preparing (START_CONNECT)',
      );
    });

    it('startInitUa должен переводить из PREPARING в CONNECTING', () => {
      stateMachine.startConnect();
      expect(stateMachine.state).toBe(EState.PREPARING);

      stateMachine.startInitUa();

      expect(stateMachine.state).toBe(EState.CONNECTING);
      expect(mockLogger).toHaveBeenCalledWith(
        'State transition: connection:preparing -> connection:connecting (START_INIT_UA)',
      );
    });

    it('reset должен переводить из DISCONNECTED в IDLE', () => {
      stateMachine.startConnect();
      events.trigger('disconnected', { socket: {} as Socket, error: false });
      expect(stateMachine.state).toBe(EState.DISCONNECTED);

      stateMachine.reset();

      expect(stateMachine.state).toBe(EState.IDLE);
      expect(mockLogger).toHaveBeenCalledWith(
        'State transition: connection:disconnected -> connection:idle (RESET)',
      );
    });

    it('reset должен переводить из ESTABLISHED в IDLE', () => {
      stateMachine.startConnect();
      stateMachine.startInitUa();
      events.trigger('connected', { socket: {} as Socket });
      expect(stateMachine.state).toBe(EState.ESTABLISHED);

      stateMachine.reset();

      expect(stateMachine.state).toBe(EState.IDLE);
      expect(mockLogger).toHaveBeenCalledWith(
        'State transition: connection:established -> connection:idle (RESET)',
      );
    });

    it('reset должен переводить из FAILED в IDLE', () => {
      stateMachine.startConnect();
      events.trigger('registrationFailed', { response: {} as IncomingResponse });
      expect(stateMachine.state).toBe(EState.FAILED);

      stateMachine.reset();

      expect(stateMachine.state).toBe(EState.IDLE);
    });
  });

  describe('Табличные переходы по доменным событиям', () => {
    const transitions: {
      title: string;
      arrange: () => void;
      expected: EState;
    }[] = [
      {
        title: 'connected переводит из CONNECTING в ESTABLISHED (через CONNECTED)',
        arrange: () => {
          stateMachine.startConnect();
          stateMachine.startInitUa();
          events.trigger('connected', { socket: {} as Socket });
        },
        expected: EState.ESTABLISHED,
      },
      {
        title: 'registered переводит из CONNECTING в ESTABLISHED (через REGISTERED)',
        arrange: () => {
          stateMachine.startConnect();
          stateMachine.startInitUa();
          events.trigger('registered', { response: {} as IncomingResponse });
        },
        expected: EState.ESTABLISHED,
      },
      {
        title: 'registered игнорируется в ESTABLISHED (нет обработчика)',
        arrange: () => {
          stateMachine.startConnect();
          stateMachine.startInitUa();
          events.trigger('connected', { socket: {} as Socket });
          // Событие registered игнорируется в ESTABLISHED
          events.trigger('registered', { response: {} as IncomingResponse });
        },
        expected: EState.ESTABLISHED,
      },
      {
        title: 'unregistered игнорируется в ESTABLISHED (нет обработчика)',
        arrange: () => {
          stateMachine.startConnect();
          stateMachine.startInitUa();
          events.trigger('registered', { response: {} as IncomingResponse });
          // Событие unregistered игнорируется в ESTABLISHED
          events.trigger('unregistered', { response: {} as IncomingResponse });
        },
        expected: EState.ESTABLISHED,
      },
      {
        title: 'disconnected переводит в DISCONNECTED независимо от активного состояния',
        arrange: () => {
          stateMachine.startConnect();
          events.trigger('disconnected', { socket: {} as Socket, error: false });
        },
        expected: EState.DISCONNECTED,
      },
      {
        title: 'registrationFailed переводит в FAILED',
        arrange: () => {
          stateMachine.startConnect();
          events.trigger('registrationFailed', { response: {} as IncomingResponse });
        },
        expected: EState.FAILED,
      },
    ];

    test.each(transitions)('$title', ({ arrange, expected }) => {
      arrange();

      expect(stateMachine.state).toBe(expected);
    });

    it('connected событие должно переводить из CONNECTING в ESTABLISHED (через CONNECTED)', () => {
      stateMachine.startConnect();
      stateMachine.startInitUa();
      expect(stateMachine.state).toBe(EState.CONNECTING);

      events.trigger('connected', { socket: {} as Socket });

      expect(stateMachine.state).toBe(EState.ESTABLISHED);
      expect(mockLogger).toHaveBeenCalledWith(
        'State transition: connection:connecting -> connection:connected (UA_CONNECTED)',
      );
      expect(mockLogger).toHaveBeenCalledWith(
        'State transition: connection:connected -> connection:established (always)',
      );
    });

    it('registered событие должно игнорироваться в ESTABLISHED (нет обработчика)', () => {
      stateMachine.startConnect();
      stateMachine.startInitUa();
      events.trigger('connected', { socket: {} as Socket });
      expect(stateMachine.state).toBe(EState.ESTABLISHED);

      // Очищаем предыдущие вызовы логгера
      mockLogger.mockClear();

      events.trigger('registered', { response: {} as IncomingResponse });

      // Событие должно быть проигнорировано, состояние не должно измениться
      expect(stateMachine.state).toBe(EState.ESTABLISHED);
      // Не должно быть логирования перехода, так как событие не обработано
      expect(mockLogger).not.toHaveBeenCalledWith(
        expect.stringContaining(
          'State transition: connection:established -> connection:registered',
        ),
      );
    });

    it('registered событие должно переводить из CONNECTING в ESTABLISHED (через REGISTERED)', () => {
      stateMachine.startConnect();
      stateMachine.startInitUa();
      expect(stateMachine.state).toBe(EState.CONNECTING);

      events.trigger('registered', { response: {} as IncomingResponse });

      expect(stateMachine.state).toBe(EState.ESTABLISHED);
      expect(mockLogger).toHaveBeenCalledWith(
        'State transition: connection:connecting -> connection:registered (UA_REGISTERED)',
      );
      expect(mockLogger).toHaveBeenCalledWith(
        'State transition: connection:registered -> connection:established (always)',
      );
    });

    it('unregistered событие должно игнорироваться в ESTABLISHED (нет обработчика)', () => {
      // Переводим в ESTABLISHED через REGISTERED
      stateMachine.startConnect();
      stateMachine.startInitUa();
      events.trigger('registered', { response: {} as IncomingResponse });
      expect(stateMachine.state).toBe(EState.ESTABLISHED);

      // Очищаем предыдущие вызовы логгера
      mockLogger.mockClear();

      events.trigger('unregistered', { response: {} as IncomingResponse });

      // Событие должно быть проигнорировано, состояние не должно измениться
      expect(stateMachine.state).toBe(EState.ESTABLISHED);
      // Не должно быть логирования перехода, так как событие не обработано
      expect(mockLogger).not.toHaveBeenCalledWith(
        expect.stringContaining('State transition: connection:established -> connection:connected'),
      );
    });

    it('disconnected событие должно переводить активные состояния в DISCONNECTED', () => {
      // Тест из PREPARING
      stateMachine.startConnect();
      events.trigger('disconnected', { socket: {} as Socket, error: false });
      expect(stateMachine.state).toBe(EState.DISCONNECTED);

      // Тест из CONNECTING
      stateMachine.reset();
      stateMachine.startConnect();
      stateMachine.startInitUa();
      events.trigger('disconnected', { socket: {} as Socket, error: false });
      expect(stateMachine.state).toBe(EState.DISCONNECTED);

      // Тест из ESTABLISHED (через CONNECTED)
      stateMachine.reset();
      stateMachine.startConnect();
      stateMachine.startInitUa();
      events.trigger('connected', { socket: {} as Socket });
      expect(stateMachine.state).toBe(EState.ESTABLISHED);
      events.trigger('disconnected', { socket: {} as Socket, error: false });
      expect(stateMachine.state).toBe(EState.DISCONNECTED);

      // Тест из ESTABLISHED (через REGISTERED)
      stateMachine.reset();
      stateMachine.startConnect();
      stateMachine.startInitUa();
      events.trigger('registered', { response: {} as IncomingResponse });
      expect(stateMachine.state).toBe(EState.ESTABLISHED);
      events.trigger('disconnected', { socket: {} as Socket, error: false });
      expect(stateMachine.state).toBe(EState.DISCONNECTED);
    });

    it('registrationFailed событие должно переводить в FAILED', () => {
      stateMachine.startConnect();
      expect(stateMachine.state).toBe(EState.PREPARING);

      events.trigger('registrationFailed', { response: {} as IncomingResponse });

      expect(stateMachine.state).toBe(EState.FAILED);
      expect(mockLogger).toHaveBeenCalledWith(
        'State transition: connection:preparing -> connection:failed (CONNECTION_FAILED)',
      );
    });

    it('connect-failed событие должно переводить в FAILED', () => {
      stateMachine.startConnect();
      expect(stateMachine.state).toBe(EState.PREPARING);

      events.trigger('connect-failed', new Error('Connection failed'));

      expect(stateMachine.state).toBe(EState.FAILED);
      expect(mockLogger).toHaveBeenCalledWith(
        'State transition: connection:preparing -> connection:failed (CONNECTION_FAILED)',
      );
    });
  });

  describe('Валидация переходов', () => {
    it('canTransition должен правильно валидировать возможные переходы', () => {
      expect(stateMachine.canTransition(EEvents.START_CONNECT)).toBe(true);
      expect(stateMachine.canTransition(EEvents.START_INIT_UA)).toBe(false);

      stateMachine.startConnect();
      expect(stateMachine.canTransition(EEvents.START_CONNECT)).toBe(false);
      expect(stateMachine.canTransition(EEvents.START_INIT_UA)).toBe(true);
    });

    it('getValidEvents должен возвращать список валидных событий', () => {
      const validEvents = stateMachine.getValidEvents();

      expect(validEvents).toContain(EEvents.START_CONNECT);
      expect(validEvents).not.toContain(EEvents.START_INIT_UA);

      stateMachine.startConnect();

      const newValidEvents = stateMachine.getValidEvents();

      expect(newValidEvents).toContain(EEvents.START_INIT_UA);
      expect(newValidEvents).toContain(EEvents.UA_DISCONNECTED);
    });

    it('должен логировать предупреждение при невалидном переходе', () => {
      // Попытка сделать невалидный переход
      stateMachine.startInitUa(); // из IDLE нельзя напрямую в CONNECTING

      expect(mockLogger).toHaveBeenCalledWith(
        'Invalid transition: START_INIT_UA from connection:idle. Event cannot be processed in current state.',
      );
      // Состояние не должно измениться
      expect(stateMachine.state).toBe(EState.IDLE);
    });
  });

  describe('Слушатели изменений состояния', () => {
    it('onStateChange должен вызывать колбэк при изменении состояния', () => {
      const mockListener = jest.fn();
      const unsubscribe = stateMachine.onStateChange(mockListener);

      stateMachine.startConnect();

      expect(mockListener).toHaveBeenCalledWith(EState.PREPARING);

      // Отписываемся и проверяем, что колбэк больше не вызывается
      unsubscribe();
      stateMachine.startInitUa();
      expect(mockListener).toHaveBeenCalledTimes(1); // только один раз
    });

    it('должен поддерживать несколько слушателей', () => {
      const mockListener1 = jest.fn();
      const mockListener2 = jest.fn();

      stateMachine.onStateChange(mockListener1);
      stateMachine.onStateChange(mockListener2);

      stateMachine.startConnect();

      expect(mockListener1).toHaveBeenCalledWith(EState.PREPARING);
      expect(mockListener2).toHaveBeenCalledWith(EState.PREPARING);
    });
  });

  describe('Жизненный цикл', () => {
    it('destroy должен отписываться от событий UA', () => {
      const spyOff = jest.spyOn(events, 'off');

      stateMachine.destroy();

      expect(spyOff).toHaveBeenCalledTimes(6); // 6 событий: connected, registered, unregistered, disconnected, registrationFailed, connect-failed
    });

    it('должен корректно работать после destroy', () => {
      stateMachine.destroy();

      // После destroy события UA не должны влиять на состояние
      const currentState = stateMachine.state;

      events.trigger('connected', { socket: {} as Socket });
      expect(stateMachine.state).toBe(currentState);
    });

    it('destroy должен очищать stateChangeListeners', () => {
      const mockListener = jest.fn();

      stateMachine.onStateChange(mockListener);
      stateMachine.startConnect();
      expect(mockListener).toHaveBeenCalledTimes(1);

      stateMachine.destroy();

      // Создаем новую машину и триггерим событие на старых events
      const newStateMachine = new ConnectionStateMachine(events);

      newStateMachine.startConnect();

      // Старый слушатель не должен быть вызван снова
      expect(mockListener).toHaveBeenCalledTimes(1);

      newStateMachine.destroy();
    });
  });

  describe('Сценарии полного жизненного цикла', () => {
    it('должен корректно проходить полный цикл подключения с регистрацией', () => {
      const stateChanges: EState[] = [];

      stateMachine.onStateChange((state) => {
        return stateChanges.push(state);
      });

      // Начинаем подключение
      stateMachine.startConnect();
      expect(stateMachine.state).toBe(EState.PREPARING);

      // Инициализируем UA
      stateMachine.startInitUa();
      expect(stateMachine.state).toBe(EState.CONNECTING);

      // UA подключился (автоматически переходит в ESTABLISHED)
      events.trigger('connected', { socket: {} as Socket });
      expect(stateMachine.state).toBe(EState.ESTABLISHED);

      // Зарегистрировались (событие игнорируется в ESTABLISHED, состояние не меняется)
      events.trigger('registered', { response: {} as IncomingResponse });
      expect(stateMachine.state).toBe(EState.ESTABLISHED);

      // Отключились
      events.trigger('disconnected', { socket: {} as Socket, error: false });
      expect(stateMachine.state).toBe(EState.DISCONNECTED);

      // Сбрасываем состояние
      stateMachine.reset();
      expect(stateMachine.state).toBe(EState.IDLE);

      // CONNECTED может не быть в списке, так как автоматический переход в ESTABLISHED происходит синхронно
      // Проверяем, что есть все ключевые состояния
      expect(stateChanges).toContain(EState.PREPARING);
      expect(stateChanges).toContain(EState.CONNECTING);
      expect(stateChanges).toContain(EState.ESTABLISHED);
      expect(stateChanges).toContain(EState.DISCONNECTED);
      expect(stateChanges).toContain(EState.IDLE);
      // ESTABLISHED должен быть после CONNECTING
      expect(stateChanges.indexOf(EState.ESTABLISHED)).toBeGreaterThan(
        stateChanges.indexOf(EState.CONNECTING),
      );
    });

    it('должен корректно обрабатывать сценарий ошибки подключения', () => {
      stateMachine.startConnect();
      stateMachine.startInitUa();

      // Ошибка регистрации
      events.trigger('registrationFailed', { response: {} as IncomingResponse });
      expect(stateMachine.state).toBe(EState.FAILED);
      expect(stateMachine.isFailed).toBe(true);

      // Можем сбросить состояние после ошибки
      expect(stateMachine.canTransition(EEvents.RESET)).toBe(true);
      stateMachine.reset();
      expect(stateMachine.state).toBe(EState.IDLE);
    });

    it('должен сохранять детальную информацию об ошибке регистрации', () => {
      stateMachine.startConnect();
      stateMachine.startInitUa();

      // Ошибка регистрации с детальной информацией
      events.trigger('registrationFailed', {
        response: { status_code: 403, reason_phrase: 'Forbidden' } as IncomingResponse,
      });

      expect(stateMachine.state).toBe(EState.FAILED);
      expect(stateMachine.isFailed).toBe(true);
      expect(stateMachine.error).toBeDefined();
      expect(stateMachine.error?.message).toBe('Registration failed: 403 Forbidden');

      // После reset ошибка должна очиститься
      stateMachine.reset();
      expect(stateMachine.state).toBe(EState.IDLE);
      expect(stateMachine.error).toBeUndefined();
    });

    it('должен корректно обрабатывать повторное подключение после ошибки регистрации', () => {
      // Первая попытка с ошибкой
      stateMachine.startConnect();
      stateMachine.startInitUa();
      events.trigger('registrationFailed', {
        response: { status_code: 401, reason_phrase: 'Unauthorized' } as IncomingResponse,
      });

      expect(stateMachine.state).toBe(EState.FAILED);
      expect(stateMachine.error?.message).toBe('Registration failed: 401 Unauthorized');

      // Повторная попытка подключения
      stateMachine.startConnect();
      expect(stateMachine.state).toBe(EState.PREPARING);
      expect(stateMachine.error).toBeUndefined(); // ошибка должна очиститься

      stateMachine.startInitUa();
      events.trigger('connected', { socket: {} as Socket });
      events.trigger('registered', { response: {} as IncomingResponse });

      expect(stateMachine.state).toBe(EState.ESTABLISHED);
      expect(stateMachine.error).toBeUndefined();
    });

    it('должен корректно обрабатывать подключение без регистрации', () => {
      stateMachine.startConnect();
      stateMachine.startInitUa();

      // Просто подключились без регистрации (автоматически переходит в ESTABLISHED)
      events.trigger('connected', { socket: {} as Socket });
      expect(stateMachine.state).toBe(EState.ESTABLISHED);
      expect(stateMachine.isEstablished).toBe(true);
      expect(stateMachine.isRegistered).toBe(false);

      // Отключились
      events.trigger('disconnected', { socket: {} as Socket, error: false });
      expect(stateMachine.state).toBe(EState.DISCONNECTED);
    });
  });

  describe('Контекст ошибки', () => {
    it('error должен быть undefined в начальном состоянии', () => {
      expect(stateMachine.error).toBeUndefined();
    });

    it('error должен сохраняться при переходе в FAILED через registrationFailed с response', () => {
      stateMachine.startConnect();

      events.trigger('registrationFailed', {
        response: { status_code: 403, reason_phrase: 'Forbidden' } as IncomingResponse,
      });

      expect(stateMachine.state).toBe(EState.FAILED);
      expect(stateMachine.error).toBeDefined();
      expect(stateMachine.error?.message).toBe('Registration failed: 403 Forbidden');
    });

    it('error должен создаваться с дефолтными значениями при неполном response', () => {
      stateMachine.startConnect();

      events.trigger('registrationFailed', {
        response: {} as IncomingResponse,
      });

      expect(stateMachine.state).toBe(EState.FAILED);
      expect(stateMachine.error).toBeDefined();
      expect(stateMachine.error?.message).toBe('Registration failed: Unknown Registration failed');
    });

    it('error должен правильно обрабатывать response с только status_code', () => {
      stateMachine.startConnect();

      events.trigger('registrationFailed', {
        response: { status_code: 401 } as IncomingResponse,
      });

      expect(stateMachine.state).toBe(EState.FAILED);
      expect(stateMachine.error).toBeDefined();
      expect(stateMachine.error?.message).toBe('Registration failed: 401 Registration failed');
    });

    it('error должен правильно обрабатывать response с только reason_phrase', () => {
      stateMachine.startConnect();

      events.trigger('registrationFailed', {
        response: { reason_phrase: 'Service Unavailable' } as IncomingResponse,
      });

      expect(stateMachine.state).toBe(EState.FAILED);
      expect(stateMachine.error).toBeDefined();
      expect(stateMachine.error?.message).toBe('Registration failed: Unknown Service Unavailable');
    });

    it('error должен сохраняться при переходе в FAILED через connect-failed с Error', () => {
      const testError = new Error('Connection failed');

      stateMachine.startConnect();

      events.trigger('connect-failed', testError);

      expect(stateMachine.state).toBe(EState.FAILED);
      expect(stateMachine.error).toBe(testError);
    });

    it('error должен быть undefined при CONNECTION_FAILED без свойства error', () => {
      stateMachine.startConnect();

      // Отправляем CONNECTION_FAILED событие напрямую без свойства error
      stateMachine.send({ type: EEvents.CONNECTION_FAILED });

      expect(stateMachine.state).toBe(EState.FAILED);
      expect(stateMachine.error).toBeUndefined();
    });

    it('error должен очищаться при reset из FAILED', () => {
      stateMachine.startConnect();
      events.trigger('registrationFailed', { response: {} as IncomingResponse });
      expect(stateMachine.state).toBe(EState.FAILED);

      stateMachine.reset();

      expect(stateMachine.state).toBe(EState.IDLE);
      expect(stateMachine.error).toBeUndefined();
    });

    it('error должен очищаться при startConnect из FAILED', () => {
      stateMachine.startConnect();
      events.trigger('registrationFailed', { response: {} as IncomingResponse });
      expect(stateMachine.state).toBe(EState.FAILED);

      stateMachine.startConnect();

      expect(stateMachine.state).toBe(EState.PREPARING);
      expect(stateMachine.error).toBeUndefined();
    });
  });

  describe('Граничные случаи', () => {
    it('должен игнорировать события UA в неподходящих состояниях', () => {
      // В состоянии IDLE события UA не должны менять состояние
      expect(stateMachine.state).toBe(EState.IDLE);

      events.trigger('connected', { socket: {} as Socket });
      expect(stateMachine.state).toBe(EState.IDLE);

      events.trigger('registered', { response: {} as IncomingResponse });
      expect(stateMachine.state).toBe(EState.IDLE);

      events.trigger('unregistered', { response: {} as IncomingResponse });
      expect(stateMachine.state).toBe(EState.IDLE);
    });

    it('должен корректно обрабатывать множественные вызовы startConnect', () => {
      stateMachine.startConnect();
      expect(stateMachine.state).toBe(EState.PREPARING);

      // Повторный вызов должен логировать предупреждение
      stateMachine.startConnect();
      expect(mockLogger).toHaveBeenCalledWith(
        'Invalid transition: START_CONNECT from connection:preparing. Event cannot be processed in current state.',
      );
      expect(stateMachine.state).toBe(EState.PREPARING); // состояние не изменилось
    });

    it('должен корректно работать геттер isDisconnected', () => {
      // В начальном состоянии
      expect(stateMachine.isDisconnected).toBe(false);

      // Переводим в DISCONNECTED
      stateMachine.startConnect();
      events.trigger('disconnected', { socket: {} as Socket, error: false });
      expect(stateMachine.isDisconnected).toBe(true);
      expect(stateMachine.state).toBe(EState.DISCONNECTED);
    });

    it('должен корректно работать геттер isFailed', () => {
      // В начальном состоянии
      expect(stateMachine.isFailed).toBe(false);

      // Переводим в FAILED
      stateMachine.startConnect();
      events.trigger('registrationFailed', { response: {} as IncomingResponse });
      expect(stateMachine.isFailed).toBe(true);
      expect(stateMachine.state).toBe(EState.FAILED);
    });

    it('должен корректно логировать невалидные переходы', () => {
      // Очищаем предыдущие вызовы логгера
      mockLogger.mockClear();

      // Попытка сделать невалидный переход
      stateMachine.startInitUa(); // из IDLE нельзя напрямую в CONNECTING

      // Проверяем, что было логирование невалидного перехода
      expect(mockLogger).toHaveBeenCalledWith(
        'Invalid transition: START_INIT_UA from connection:idle. Event cannot be processed in current state.',
      );
    });
  });
});
