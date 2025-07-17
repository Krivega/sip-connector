import Events from 'events-constructor';
import { UA_EVENT_NAMES } from '../../eventNames';
import logger from '../../logger';
import ConnectionStateMachine, { EEvents, EState } from '../ConnectionStateMachine';

// Мокаем logger
jest.mock('../../logger', () => {
  return jest.fn();
});

describe('ConnectionStateMachine', () => {
  let uaEvents: Events<typeof UA_EVENT_NAMES>;
  let stateMachine: ConnectionStateMachine;
  const mockLogger = logger as jest.MockedFunction<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    uaEvents = new Events<typeof UA_EVENT_NAMES>(UA_EVENT_NAMES);
    stateMachine = new ConnectionStateMachine(uaEvents);
  });

  afterEach(() => {
    stateMachine.destroy();
  });

  describe('Инициализация', () => {
    test('должен инициализироваться с состоянием IDLE', () => {
      expect(stateMachine.state).toBe(EState.IDLE);
      expect(stateMachine.isIdle).toBe(true);
      expect(stateMachine.isPending).toBe(false);
    });

    test('должен подписаться на события UA при создании', () => {
      const spyOn = jest.spyOn(uaEvents, 'on');

      // Создаем новую stateMachine для проверки подписки
      const newStateMachine = new ConnectionStateMachine(uaEvents);

      expect(spyOn).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(spyOn).toHaveBeenCalledWith('registered', expect.any(Function));
      expect(spyOn).toHaveBeenCalledWith('unregistered', expect.any(Function));
      expect(spyOn).toHaveBeenCalledWith('disconnected', expect.any(Function));
      expect(spyOn).toHaveBeenCalledWith('registrationFailed', expect.any(Function));

      newStateMachine.destroy();
    });

    test('должен логировать изменения состояний', () => {
      // Очищаем предыдущие вызовы
      mockLogger.mockClear();

      stateMachine.startConnect();

      expect(mockLogger).toHaveBeenCalledWith(
        'State transition: idle -> connecting (START_CONNECT)',
      );
    });
  });

  describe('Геттеры состояний', () => {
    test('isIdle должен возвращать true только для IDLE', () => {
      expect(stateMachine.isIdle).toBe(true);
      stateMachine.startConnect();
      expect(stateMachine.isIdle).toBe(false);
    });

    test('isConnecting должен возвращать true только для CONNECTING', () => {
      expect(stateMachine.isConnecting).toBe(false);
      stateMachine.startConnect();
      expect(stateMachine.isConnecting).toBe(true);
    });

    test('isInitializing должен возвращать true только для INITIALIZING', () => {
      stateMachine.startConnect();
      expect(stateMachine.isInitializing).toBe(false);
      stateMachine.startInitUa();
      expect(stateMachine.isInitializing).toBe(true);
    });

    test('isPending должен возвращать true для CONNECTING и INITIALIZING', () => {
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

    test('isActiveConnection должен возвращать true для CONNECTED и REGISTERED', () => {
      expect(stateMachine.isActiveConnection).toBe(false);

      // Переводим в состояние CONNECTED
      stateMachine.startConnect();
      stateMachine.startInitUa();
      uaEvents.trigger('connected', undefined);
      expect(stateMachine.isActiveConnection).toBe(true);
      expect(stateMachine.isConnected).toBe(true);

      // Переводим в состояние REGISTERED
      uaEvents.trigger('registered', undefined);
      expect(stateMachine.isActiveConnection).toBe(true);
      expect(stateMachine.isRegistered).toBe(true);
    });
  });

  describe('Публичные методы переходов', () => {
    test('startConnect должен переводить из IDLE в CONNECTING', () => {
      expect(stateMachine.state).toBe(EState.IDLE);

      stateMachine.startConnect();

      expect(stateMachine.state).toBe(EState.CONNECTING);
      expect(mockLogger).toHaveBeenCalledWith(
        'State transition: idle -> connecting (START_CONNECT)',
      );
    });

    test('startInitUa должен переводить из CONNECTING в INITIALIZING', () => {
      stateMachine.startConnect();
      expect(stateMachine.state).toBe(EState.CONNECTING);

      stateMachine.startInitUa();

      expect(stateMachine.state).toBe(EState.INITIALIZING);
      expect(mockLogger).toHaveBeenCalledWith(
        'State transition: connecting -> initializing (START_INIT_UA)',
      );
    });

    test('reset должен переводить из DISCONNECTED в IDLE', () => {
      stateMachine.startConnect();
      uaEvents.trigger('disconnected', undefined);
      expect(stateMachine.state).toBe(EState.DISCONNECTED);

      stateMachine.reset();

      expect(stateMachine.state).toBe(EState.IDLE);
      expect(mockLogger).toHaveBeenCalledWith('State transition: disconnected -> idle (RESET)');
    });

    test('reset должен переводить из FAILED в IDLE', () => {
      stateMachine.startConnect();
      uaEvents.trigger('registrationFailed', undefined);
      expect(stateMachine.state).toBe(EState.FAILED);

      stateMachine.reset();

      expect(stateMachine.state).toBe(EState.IDLE);
    });
  });

  describe('Автоматические переходы по событиям UA', () => {
    test('connected событие должно переводить из INITIALIZING в CONNECTED', () => {
      stateMachine.startConnect();
      stateMachine.startInitUa();
      expect(stateMachine.state).toBe(EState.INITIALIZING);

      uaEvents.trigger('connected', undefined);

      expect(stateMachine.state).toBe(EState.CONNECTED);
      expect(mockLogger).toHaveBeenCalledWith(
        'State transition: initializing -> connected (UA_CONNECTED)',
      );
    });

    test('registered событие должно переводить из CONNECTED в REGISTERED', () => {
      stateMachine.startConnect();
      stateMachine.startInitUa();
      uaEvents.trigger('connected', undefined);
      expect(stateMachine.state).toBe(EState.CONNECTED);

      uaEvents.trigger('registered', undefined);

      expect(stateMachine.state).toBe(EState.REGISTERED);
      expect(mockLogger).toHaveBeenCalledWith(
        'State transition: connected -> registered (UA_REGISTERED)',
      );
    });

    test('registered событие должно переводить из INITIALIZING в REGISTERED', () => {
      stateMachine.startConnect();
      stateMachine.startInitUa();
      expect(stateMachine.state).toBe(EState.INITIALIZING);

      uaEvents.trigger('registered', undefined);

      expect(stateMachine.state).toBe(EState.REGISTERED);
    });

    test('unregistered событие должно переводить из REGISTERED в CONNECTED', () => {
      // Переводим в REGISTERED
      stateMachine.startConnect();
      stateMachine.startInitUa();
      uaEvents.trigger('registered', undefined);
      expect(stateMachine.state).toBe(EState.REGISTERED);

      uaEvents.trigger('unregistered', undefined);

      expect(stateMachine.state).toBe(EState.CONNECTED);
      expect(mockLogger).toHaveBeenCalledWith(
        'State transition: registered -> connected (UA_UNREGISTERED)',
      );
    });

    test('disconnected событие должно переводить активные состояния в DISCONNECTED', () => {
      // Тест из CONNECTING
      stateMachine.startConnect();
      uaEvents.trigger('disconnected', undefined);
      expect(stateMachine.state).toBe(EState.DISCONNECTED);

      // Тест из INITIALIZING
      stateMachine.reset();
      stateMachine.startConnect();
      stateMachine.startInitUa();
      uaEvents.trigger('disconnected', undefined);
      expect(stateMachine.state).toBe(EState.DISCONNECTED);

      // Тест из CONNECTED
      stateMachine.reset();
      stateMachine.startConnect();
      stateMachine.startInitUa();
      uaEvents.trigger('connected', undefined);
      uaEvents.trigger('disconnected', undefined);
      expect(stateMachine.state).toBe(EState.DISCONNECTED);
    });

    test('registrationFailed событие должно переводить в FAILED', () => {
      stateMachine.startConnect();
      expect(stateMachine.state).toBe(EState.CONNECTING);

      uaEvents.trigger('registrationFailed', undefined);

      expect(stateMachine.state).toBe(EState.FAILED);
      expect(mockLogger).toHaveBeenCalledWith(
        'State transition: connecting -> failed (CONNECTION_FAILED)',
      );
    });
  });

  describe('Валидация переходов', () => {
    test('canTransition должен правильно валидировать возможные переходы', () => {
      expect(stateMachine.canTransition(EEvents.START_CONNECT)).toBe(true);
      expect(stateMachine.canTransition(EEvents.START_INIT_UA)).toBe(false);

      stateMachine.startConnect();
      expect(stateMachine.canTransition(EEvents.START_CONNECT)).toBe(false);
      expect(stateMachine.canTransition(EEvents.START_INIT_UA)).toBe(true);
    });

    test('getValidEvents должен возвращать список валидных событий', () => {
      const validEvents = stateMachine.getValidEvents();

      expect(validEvents).toContain(EEvents.START_CONNECT);
      expect(validEvents).not.toContain(EEvents.START_INIT_UA);

      stateMachine.startConnect();

      const newValidEvents = stateMachine.getValidEvents();

      expect(newValidEvents).toContain(EEvents.START_INIT_UA);
      expect(newValidEvents).toContain(EEvents.UA_DISCONNECTED);
    });

    test('должен логировать предупреждение при невалидном переходе', () => {
      // Попытка сделать невалидный переход
      stateMachine.startInitUa(); // из IDLE нельзя напрямую в INITIALIZING

      expect(mockLogger).toHaveBeenCalledWith(
        'Invalid transition: START_INIT_UA from idle. Event cannot be processed in current state.',
      );
      // Состояние не должно измениться
      expect(stateMachine.state).toBe(EState.IDLE);
    });
  });

  describe('Слушатели изменений состояния', () => {
    test('onStateChange должен вызывать колбэк при изменении состояния', () => {
      const mockListener = jest.fn();
      const unsubscribe = stateMachine.onStateChange(mockListener);

      stateMachine.startConnect();

      expect(mockListener).toHaveBeenCalledWith(EState.CONNECTING);

      // Отписываемся и проверяем, что колбэк больше не вызывается
      unsubscribe();
      stateMachine.startInitUa();
      expect(mockListener).toHaveBeenCalledTimes(1); // только один раз
    });

    test('должен поддерживать несколько слушателей', () => {
      const mockListener1 = jest.fn();
      const mockListener2 = jest.fn();

      stateMachine.onStateChange(mockListener1);
      stateMachine.onStateChange(mockListener2);

      stateMachine.startConnect();

      expect(mockListener1).toHaveBeenCalledWith(EState.CONNECTING);
      expect(mockListener2).toHaveBeenCalledWith(EState.CONNECTING);
    });
  });

  describe('Жизненный цикл', () => {
    test('destroy должен отписываться от событий UA', () => {
      const spyOff = jest.spyOn(uaEvents, 'off');

      stateMachine.destroy();

      expect(spyOff).toHaveBeenCalledTimes(5); // 5 событий: connected, registered, unregistered, disconnected, registrationFailed
    });

    test('должен корректно работать после destroy', () => {
      stateMachine.destroy();

      // После destroy события UA не должны влиять на состояние
      const currentState = stateMachine.state;

      uaEvents.trigger('connected', undefined);
      expect(stateMachine.state).toBe(currentState);
    });
  });

  describe('Сценарии полного жизненного цикла', () => {
    test('должен корректно проходить полный цикл подключения с регистрацией', () => {
      const stateChanges: EState[] = [];

      stateMachine.onStateChange((state) => {
        return stateChanges.push(state);
      });

      // Начинаем подключение
      stateMachine.startConnect();
      expect(stateMachine.state).toBe(EState.CONNECTING);

      // Инициализируем UA
      stateMachine.startInitUa();
      expect(stateMachine.state).toBe(EState.INITIALIZING);

      // UA подключился и зарегистрировался
      uaEvents.trigger('registered', undefined);
      expect(stateMachine.state).toBe(EState.REGISTERED);

      // Разрегистрировались
      uaEvents.trigger('unregistered', undefined);
      expect(stateMachine.state).toBe(EState.CONNECTED);

      // Отключились
      uaEvents.trigger('disconnected', undefined);
      expect(stateMachine.state).toBe(EState.DISCONNECTED);

      // Сбрасываем состояние
      stateMachine.reset();
      expect(stateMachine.state).toBe(EState.IDLE);

      expect(stateChanges).toEqual([
        EState.CONNECTING,
        EState.INITIALIZING,
        EState.REGISTERED,
        EState.CONNECTED,
        EState.DISCONNECTED,
        EState.IDLE,
      ]);
    });

    test('должен корректно обрабатывать сценарий ошибки подключения', () => {
      stateMachine.startConnect();
      stateMachine.startInitUa();

      // Ошибка регистрации
      uaEvents.trigger('registrationFailed', undefined);
      expect(stateMachine.state).toBe(EState.FAILED);
      expect(stateMachine.isFailed).toBe(true);

      // Можем сбросить состояние после ошибки
      expect(stateMachine.canTransition(EEvents.RESET)).toBe(true);
      stateMachine.reset();
      expect(stateMachine.state).toBe(EState.IDLE);
    });

    test('должен корректно обрабатывать подключение без регистрации', () => {
      stateMachine.startConnect();
      stateMachine.startInitUa();

      // Просто подключились без регистрации
      uaEvents.trigger('connected', undefined);
      expect(stateMachine.state).toBe(EState.CONNECTED);
      expect(stateMachine.isConnected).toBe(true);
      expect(stateMachine.isRegistered).toBe(false);

      // Отключились
      uaEvents.trigger('disconnected', undefined);
      expect(stateMachine.state).toBe(EState.DISCONNECTED);
    });
  });

  describe('Edge cases', () => {
    test('должен игнорировать события UA в неподходящих состояниях', () => {
      // В состоянии IDLE события UA не должны менять состояние
      expect(stateMachine.state).toBe(EState.IDLE);

      uaEvents.trigger('connected', undefined);
      expect(stateMachine.state).toBe(EState.IDLE);

      uaEvents.trigger('registered', undefined);
      expect(stateMachine.state).toBe(EState.IDLE);

      uaEvents.trigger('unregistered', undefined);
      expect(stateMachine.state).toBe(EState.IDLE);
    });

    test('должен корректно обрабатывать множественные вызовы startConnect', () => {
      stateMachine.startConnect();
      expect(stateMachine.state).toBe(EState.CONNECTING);

      // Повторный вызов должен логировать предупреждение
      stateMachine.startConnect();
      expect(mockLogger).toHaveBeenCalledWith(
        'Invalid transition: START_CONNECT from connecting. Event cannot be processed in current state.',
      );
      expect(stateMachine.state).toBe(EState.CONNECTING); // состояние не изменилось
    });
  });
});
