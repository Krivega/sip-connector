import jssip from '../../__fixtures__/jssip.mock';
import UAMock, { PASSWORD_CORRECT } from '../../__fixtures__/UA.mock';
import type { TJsSIP } from '../../types';
import ConnectionManager from '../@ConnectionManager';

// Учитываем задержку, заложенную в моках UA
jest.setTimeout(5000);

describe('ConnectionManager', () => {
  const SIP_SERVER_URL = 'sip.example.com';
  const WS_URL = 'wss://sip.example.com:8089/ws';
  let connectionManager: ConnectionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    // Сбрасываем внутреннее состояние мока UA
    UAMock.reset();

    connectionManager = new ConnectionManager({
      JsSIP: jssip as unknown as TJsSIP,
    });
  });

  describe('constructor', () => {
    it('должен корректно создавать экземпляр', () => {
      expect(connectionManager).toBeInstanceOf(ConnectionManager);
      // UA изначально не настроен
      expect(connectionManager.isConfigured()).toBe(false);
    });
  });

  describe('connect', () => {
    it('должен успешно подключаться без регистрации', async () => {
      const parameters = {
        displayName: 'Test User',
        register: false,
        sipServerUrl: SIP_SERVER_URL,
        sipWebSocketServerURL: WS_URL,
      } as const;

      const ua = await connectionManager.connect(parameters);

      // Проверяем, что возвращён UA и он сохранён внутри ConnectionManager
      expect(ua).toBeInstanceOf(UAMock);
      expect(connectionManager.ua).toBe(ua);

      // Конфигурация установлена
      expect(connectionManager.isConfigured()).toBe(true);
      // Регистрация не запрашивалась
      expect(connectionManager.isRegisterConfig).toBe(false);
      expect(connectionManager.isRegistered).toBe(false);

      // Проверяем, что socket был установлен
      expect(connectionManager.socket).toBeDefined();

      const socketInstance = connectionManager.socket;

      expect(socketInstance?.url).toBe(WS_URL);

      // Проверяем helper для формирования SIP URI
      const sipUri = connectionManager.getSipServerUrl('testuser');

      expect(sipUri).toBe(`sip:testuser@${SIP_SERVER_URL}`);
    });

    it('должен успешно подключаться c регистрацией', async () => {
      const user = 'testuser';
      const parameters = {
        displayName: 'Test User',
        user,
        password: PASSWORD_CORRECT,
        register: true,
        sipServerUrl: SIP_SERVER_URL,
        sipWebSocketServerURL: WS_URL,
      } as const;

      const ua = await connectionManager.connect(parameters);

      // UA сохранён внутри менеджера
      expect(connectionManager.ua).toBe(ua);
      // Регистрационная конфигурация установлена
      expect(connectionManager.isRegisterConfig).toBe(true);
      // UA успешно зарегистрирован
      expect(connectionManager.isRegistered).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('должен корректно завершать соединение при наличии UA', async () => {
      const parameters = {
        displayName: 'Test User',
        register: false,
        sipServerUrl: SIP_SERVER_URL,
        sipWebSocketServerURL: WS_URL,
      } as const;

      await connectionManager.connect(parameters);

      const uaInstance = connectionManager.ua;

      expect(uaInstance).toBeDefined();

      const ua = uaInstance as unknown as UAMock;
      const stopSpy = jest.spyOn(ua, 'stop');

      await connectionManager.disconnect();

      // UA.stop должен быть вызван
      expect(stopSpy).toHaveBeenCalled();
      // UA внутри менеджера должен быть очищен
      expect(connectionManager.ua).toBeUndefined();
      // Состояние конфигурации очищено
      expect(connectionManager.isConfigured()).toBe(false);
    });

    it('должен корректно завершать соединение при отсутствии UA', async () => {
      // UA не устанавливалось, сразу вызываем disconnect
      await expect(connectionManager.disconnect()).resolves.toBeUndefined();
      // Дополнительно убеждаемся, что UA так и не появилось
      expect(connectionManager.ua).toBeUndefined();
    });
  });

  describe('registration operations', () => {
    it('должен регистрировать и разрегистрировать UA', async () => {
      const user = 'testuser';
      const parameters = {
        displayName: 'Test User',
        user,
        password: PASSWORD_CORRECT,
        register: true,
        sipServerUrl: SIP_SERVER_URL,
        sipWebSocketServerURL: WS_URL,
      } as const;

      await connectionManager.connect(parameters);

      // Проверяем, что UA зарегистрирован из-за register: true
      expect(connectionManager.isRegistered).toBe(true);

      // Вызываем unregister
      const unregisteredEvent = await connectionManager.unregister();

      expect(unregisteredEvent).toBeDefined();
      expect(connectionManager.isRegistered).toBe(false);

      // Повторно вызываем register
      const registeredEvent = await connectionManager.register();

      expect(registeredEvent).toBeDefined();
      expect(connectionManager.isRegistered).toBe(true);
    });

    it('должен вызывать tryRegister', async () => {
      const user = 'testuser';
      const parameters = {
        displayName: 'Test User',
        user,
        password: PASSWORD_CORRECT,
        register: true,
        sipServerUrl: SIP_SERVER_URL,
        sipWebSocketServerURL: WS_URL,
      } as const;

      await connectionManager.connect(parameters);

      const result = await connectionManager.tryRegister();

      expect(result).toBeDefined();
    });
  });

  describe('SIP operations', () => {
    it('должен вызывать sendOptions', async () => {
      const parameters = {
        displayName: 'Test User',
        register: false,
        sipServerUrl: SIP_SERVER_URL,
        sipWebSocketServerURL: WS_URL,
      } as const;

      await connectionManager.connect(parameters);

      const target = 'sip:test@example.com';
      const body = 'test body';
      const extraHeaders = ['X-Test: value'];

      const result = connectionManager.sendOptions(target, body, extraHeaders);

      expect(result).toBeInstanceOf(Promise);
    });

    it('должен вызывать ping', async () => {
      const parameters = {
        displayName: 'Test User',
        register: false,
        sipServerUrl: SIP_SERVER_URL,
        sipWebSocketServerURL: WS_URL,
      } as const;

      await connectionManager.connect(parameters);

      const body = 'ping body';
      const extraHeaders = ['X-Ping: value'];

      const result = connectionManager.ping(body, extraHeaders);

      expect(result).toBeInstanceOf(Promise);
    });

    it('должен вызывать checkTelephony', async () => {
      const parameters = {
        displayName: 'Test User',
        register: false,
        sipServerUrl: SIP_SERVER_URL,
        sipWebSocketServerURL: WS_URL,
      } as const;

      await connectionManager.connect(parameters);

      const telephonyParams = {
        target: 'sip:test@example.com',
        body: 'test body',
        extraHeaders: ['X-Test: value'],
        displayName: 'Test User',
        sipServerUrl: SIP_SERVER_URL,
        sipWebSocketServerURL: WS_URL,
      };

      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      const result = await connectionManager.checkTelephony(telephonyParams);

      expect(result).toBeUndefined();
    });
  });

  describe('event handling', () => {
    it('должен поддерживать on/off события', () => {
      const handler = jest.fn();
      const eventName = 'connected';

      const unsubscribe = connectionManager.on(eventName, handler);

      expect(unsubscribe).toBeDefined();

      connectionManager.off(eventName, handler);
    });

    it('должен поддерживать once события', () => {
      const handler = jest.fn();
      const eventName = 'connected';

      const unsubscribe = connectionManager.once(eventName, handler);

      expect(unsubscribe).toBeDefined();
    });

    it('должен поддерживать onceRace события', () => {
      const handler = jest.fn();
      const eventNames = ['connected' as const, 'disconnected' as const];

      const unsubscribe = connectionManager.onceRace(eventNames, handler);

      expect(unsubscribe).toBeDefined();
    });

    it('должен поддерживать wait события', async () => {
      const eventName = 'connected';

      const waitPromise = connectionManager.wait(eventName);

      expect(waitPromise).toBeInstanceOf(Promise);

      // Проверяем, что промис создан, но не разрешается без события
      expect(waitPromise).toBeInstanceOf(Promise);

      // Тест проверяет только создание промиса, так как эмиссия событий
      // происходит в реальном коде через UA события
    });

    it('должен поддерживать wait события с типизированными данными', async () => {
      const eventName = 'connected';

      const waitPromise = connectionManager.wait<{ userId: string; status: string }>(eventName);

      expect(waitPromise).toBeInstanceOf(Promise);

      // Проверяем, что промис создан с правильной типизацией
      expect(waitPromise).toBeInstanceOf(Promise);
    });

    it('должен поддерживать wait события для разных типов событий', async () => {
      const eventName = 'disconnected';

      const waitPromise = connectionManager.wait(eventName);

      expect(waitPromise).toBeInstanceOf(Promise);

      // Проверяем, что промис создан для разных типов событий
      expect(waitPromise).toBeInstanceOf(Promise);
    });

    it('должен корректно обрабатывать wait события при множественных вызовах', async () => {
      const eventName = 'connected';

      // Создаем два промиса wait
      const waitPromise1 = connectionManager.wait(eventName);
      const waitPromise2 = connectionManager.wait(eventName);

      // Проверяем, что оба промиса созданы
      expect(waitPromise1).toBeInstanceOf(Promise);
      expect(waitPromise2).toBeInstanceOf(Promise);
      expect(waitPromise1).not.toBe(waitPromise2); // Разные промисы
    });
  });

  describe('getters', () => {
    it('должен возвращать правильные значения геттеров', () => {
      expect(connectionManager.requested).toBeDefined();
      expect(connectionManager.isPendingConnect).toBeDefined();
      expect(connectionManager.isPendingInitUa).toBeDefined();
      expect(connectionManager.connectionState).toBeDefined();
      expect(connectionManager.isRegistered).toBeDefined();
      expect(connectionManager.isRegisterConfig).toBeDefined();
    });
  });

  describe('configuration methods', () => {
    it('должен возвращать конфигурацию соединения', () => {
      const config = connectionManager.getConnectionConfiguration();

      expect(config).toBeDefined();
    });

    it('должен проверять конфигурацию', () => {
      const isConfigured = connectionManager.isConfigured();

      expect(typeof isConfigured).toBe('boolean');
    });
  });

  describe('destroy', () => {
    it('должен вызывать destroy', () => {
      expect(() => {
        connectionManager.destroy();
      }).not.toThrow();
    });
  });

  describe('getSipServerUrl', () => {
    it('должен возвращать правильный SIP URL', () => {
      const id = 'testuser';
      const result = connectionManager.getSipServerUrl(id);

      expect(result).toBe(id);
    });
  });
});
