import jssip from '@/__fixtures__/jssip.mock';
import UAMock, { PASSWORD_CORRECT } from '@/__fixtures__/UA.mock';
import ConnectionManager from '../@ConnectionManager';

import type { TJsSIP } from '@/types';

// Учитываем задержку, заложенную в моках UA
jest.setTimeout(5000);

describe('ConnectionManager', () => {
  const SIP_SERVER_URL = 'sip.example.com';
  const WS_DOMAIN = 'sip.example.com:8089';
  let connectionManager: ConnectionManager;

  const parameters = {
    displayName: 'Test User',
    user: 'testuser',
    password: PASSWORD_CORRECT,
    register: false,
    sipServerIp: SIP_SERVER_URL,
    sipServerUrl: WS_DOMAIN,
  };

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
      await connectionManager.connect(parameters);

      // Конфигурация установлена
      expect(connectionManager.isConfigured()).toBe(true);
      // Регистрация не запрашивалась
      expect(connectionManager.isRegisterConfig).toBe(false);
      expect(connectionManager.isRegistered).toBe(false);

      // Проверяем, что socket был установлен
      expect(connectionManager.socket).toBeDefined();

      const socketInstance = connectionManager.socket;

      expect(socketInstance?.url).toBe(`wss://${WS_DOMAIN}/webrtc/wss/`);

      // Проверяем helper для формирования SIP URI
      const uri = connectionManager.getUri('testuser');

      expect(uri).toBe(`sip:testuser@${SIP_SERVER_URL}`);
    });

    it('должен успешно подключаться c регистрацией', async () => {
      const parameters2 = {
        displayName: 'Test User',
        user: 'testuser',
        password: PASSWORD_CORRECT,
        register: true,
        sipServerIp: SIP_SERVER_URL,
        sipServerUrl: WS_DOMAIN,
      };

      await connectionManager.connect(parameters2);

      // Регистрационная конфигурация установлена
      expect(connectionManager.isRegisterConfig).toBe(true);
      // UA успешно зарегистрирован
      expect(connectionManager.isRegistered).toBe(true);
    });

    it('должен отключаться перед подключением, если конфигурация уже установлена', async () => {
      // @ts-expect-error
      const disconnectSpy = jest.spyOn(connectionManager.connectionFlow, 'disconnect');

      await connectionManager.connect(parameters);

      expect(connectionManager.isConfigured()).toBe(true);

      await connectionManager.connect(parameters);

      expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });

    it('должен продолжить подключение, если disconnect упал с ошибкой', async () => {
      const disconnectSpy = jest.spyOn(connectionManager, 'disconnect');
      // @ts-expect-error
      const connectSpy = jest.spyOn(connectionManager.connectionFlow, 'connect');

      disconnectSpy.mockImplementation(async () => {
        throw new Error('Disconnect is failed');
      });

      await connectionManager.connect(parameters);

      expect(connectSpy).toHaveBeenCalledTimes(1);
      expect(connectionManager.isConfigured()).toBe(true);
    });

    it('должен вернуть ошибку, если подключение не доступно', async () => {
      await expect(
        connectionManager.connect(parameters, {
          hasReadyForConnection: () => {
            return false;
          },
        }),
      ).rejects.toThrow('Not ready for connection');

      expect(connectionManager.isConfigured()).toBe(false);
    });

    it('должен отключиться при ошибке подключения', async () => {
      const disconnectSpy = jest.spyOn(connectionManager, 'disconnect');

      jest
        // @ts-expect-error
        .spyOn(connectionManager.connectionFlow, 'connect')
        .mockRejectedValue(new Error('Connect is failed'));

      await connectionManager.connect(parameters).catch(() => {});

      expect(connectionManager.isConfigured()).toBe(false);
      expect(disconnectSpy).toHaveBeenCalledTimes(2);
    });

    it('должен подключаться с параметрами из функции', async () => {
      const getParameters = async () => {
        return parameters;
      };

      await connectionManager.connect(getParameters);

      expect(connectionManager.isConfigured()).toBe(true);
    });

    it('должен обработать ошибку, если функция с параметрами вернула ошибку', async () => {
      const disconnectSpy = jest.spyOn(connectionManager, 'disconnect');

      const getParameters = async () => {
        throw new Error('Get parameters is failed');
      };

      await connectionManager.connect(getParameters).catch(() => {});

      expect(connectionManager.isConfigured()).toBe(false);
      expect(disconnectSpy).toHaveBeenCalledTimes(2);
    });

    it('должен возвращать новую ошибку, если подключение завершилось с несуществующей ошибкой', async () => {
      jest
        // @ts-expect-error
        .spyOn(connectionManager.connectionFlow, 'connect')
        .mockRejectedValue(undefined);

      await expect(connectionManager.connect(parameters)).rejects.toThrow(
        'Failed to connect to server',
      );
    });
  });

  describe('disconnect', () => {
    it('должен корректно завершать соединение при наличии UA', async () => {
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

    it('не должен завершать соединение при отсутствии конфигурации', async () => {
      // @ts-expect-error
      const disconnectSpy = jest.spyOn(connectionManager.connectionFlow, 'disconnect');

      await expect(connectionManager.disconnect()).resolves.toBeUndefined();
      expect(disconnectSpy).not.toHaveBeenCalled();
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
      const parameters2 = {
        displayName: 'Test User',
        user,
        password: PASSWORD_CORRECT,
        register: true,
        sipServerIp: SIP_SERVER_URL,
        sipServerUrl: WS_DOMAIN,
      };

      await connectionManager.connect(parameters2);

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
      const parameters2 = {
        displayName: 'Test User',
        user: 'testuser',
        password: PASSWORD_CORRECT,
        register: true,
        sipServerIp: SIP_SERVER_URL,
        sipServerUrl: WS_DOMAIN,
      };

      await connectionManager.connect(parameters2);

      const result = await connectionManager.tryRegister();

      expect(result).toBeDefined();
    });
  });

  describe('SIP operations', () => {
    it('должен вызывать sendOptions', async () => {
      await connectionManager.connect(parameters);

      const target = 'sip:test@example.com';
      const body = 'test body';
      const extraHeaders = ['X-Test: value'];

      const result = connectionManager.sendOptions(target, body, extraHeaders);

      expect(result).toBeInstanceOf(Promise);
    });

    it('должен вызывать ping', async () => {
      await connectionManager.connect(parameters);

      const body = 'ping body';
      const extraHeaders = ['X-Ping: value'];

      const result = connectionManager.ping(body, extraHeaders);

      expect(result).toBeInstanceOf(Promise);
    });

    it('должен вызывать checkTelephony', async () => {
      await connectionManager.connect(parameters);

      const telephonyParams = {
        target: 'sip:test@example.com',
        body: 'test body',
        extraHeaders: ['X-Test: value'],
        displayName: 'Test User',
        sipServerIp: SIP_SERVER_URL,
        sipServerUrl: WS_DOMAIN,
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

      const waitPromise = connectionManager.wait(eventName);

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

    it('должен вызывать CONNECT_STARTED при запуске подключения', async () => {
      const handleStarted = jest.fn();

      connectionManager.on('connect-started', handleStarted);

      await connectionManager.connect(parameters);

      expect(handleStarted).toHaveBeenCalled();
    });

    it('должен вызывать CONNECT_SUCCEEDED при успешном подключении', async () => {
      const handleSucceeded = jest.fn();

      connectionManager.on('connect-succeeded', handleSucceeded);

      await connectionManager.connect(parameters);

      expect(handleSucceeded).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: parameters.displayName,
          register: parameters.register,
          sipServerIp: parameters.sipServerIp,
          sipServerUrl: parameters.sipServerUrl,
          user: parameters.user,
          password: parameters.password,
        }),
      );
    });

    it('должен вызывать CONNECT_FAILED при ошибке подключения', async () => {
      jest
        // @ts-expect-error
        .spyOn(connectionManager.connectionFlow, 'connect')
        .mockRejectedValue(new Error('Connect is failed'));

      const handleFailed = jest.fn();

      connectionManager.on('connect-failed', handleFailed);

      await connectionManager.connect(parameters).catch(() => {});

      expect(handleFailed).toHaveBeenCalled();
    });

    it('должен вызывать CONNECT_FAILED, если функция с параметрами вернула ошибку', async () => {
      const handleFailed = jest.fn();

      connectionManager.on('connect-failed', handleFailed);

      const getParameters = async () => {
        throw new Error('Get parameters is failed');
      };

      await connectionManager.connect(getParameters).catch(() => {});

      expect(handleFailed).toHaveBeenCalled();
    });

    it('должен вызывать CONNECT_PARAMETERS_RESOLVE_FAILED при ошибке в resolveParameters', async () => {
      const handleParametersResolveFailed = jest.fn();
      const handleFailed = jest.fn();

      connectionManager.on('connect-parameters-resolve-failed', handleParametersResolveFailed);
      connectionManager.on('connect-failed', handleFailed);

      const getParameters = async () => {
        throw new Error('Get parameters is failed');
      };

      await connectionManager.connect(getParameters).catch(() => {});

      expect(handleParametersResolveFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Get parameters is failed',
        }),
      );
      expect(handleFailed).toHaveBeenCalled();
    });

    it('не должен вызывать CONNECT_PARAMETERS_RESOLVE_FAILED при ошибке в connectionFlow.connect', async () => {
      jest
        // @ts-expect-error
        .spyOn(connectionManager.connectionFlow, 'connect')
        .mockRejectedValue(new Error('Connect is failed'));

      const handleParametersResolveFailed = jest.fn();
      const handleFailed = jest.fn();

      connectionManager.on('connect-parameters-resolve-failed', handleParametersResolveFailed);
      connectionManager.on('connect-failed', handleFailed);

      await connectionManager.connect(parameters).catch(() => {});

      expect(handleParametersResolveFailed).not.toHaveBeenCalled();
      expect(handleFailed).toHaveBeenCalled();
    });

    it('должен вызывать CONNECT_PARAMETERS_RESOLVE_SUCCESS при успешном разрешении параметров (объект)', async () => {
      const handleParametersResolveSuccess = jest.fn(() => {
        return undefined;
      });
      const handleSucceeded = jest.fn(() => {
        return undefined;
      });

      connectionManager.on('connect-parameters-resolve-success', handleParametersResolveSuccess);
      connectionManager.on('connect-succeeded', handleSucceeded);

      await connectionManager.connect(parameters);

      expect(handleParametersResolveSuccess).toHaveBeenCalledWith(parameters);
      expect(handleSucceeded).toHaveBeenCalled();
    });

    it('должен вызывать CONNECT_PARAMETERS_RESOLVE_SUCCESS при успешном разрешении параметров (функция)', async () => {
      const handleParametersResolveSuccess = jest.fn(() => {
        return undefined;
      });
      const handleSucceeded = jest.fn(() => {
        return undefined;
      });

      connectionManager.on('connect-parameters-resolve-success', handleParametersResolveSuccess);
      connectionManager.on('connect-succeeded', handleSucceeded);

      const getParameters = async () => {
        return parameters;
      };

      await connectionManager.connect(getParameters);

      expect(handleParametersResolveSuccess).toHaveBeenCalledWith(parameters);
      expect(handleSucceeded).toHaveBeenCalled();
    });

    it('должен вызывать события в правильном порядке', async () => {
      const eventOrder: string[] = [];
      const handleStarted = jest.fn(() => {
        return eventOrder.push('started');
      });
      const handleParametersResolveSuccess = jest.fn(() => {
        return eventOrder.push('parameters-resolve-success');
      });
      const handleSucceeded = jest.fn(() => {
        return eventOrder.push('succeeded');
      });

      connectionManager.on('connect-started', handleStarted);
      connectionManager.on('connect-parameters-resolve-success', handleParametersResolveSuccess);
      connectionManager.on('connect-succeeded', handleSucceeded);

      await connectionManager.connect(parameters);

      expect(eventOrder).toEqual(['started', 'parameters-resolve-success', 'succeeded']);
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
      expect(connectionManager.isDisconnected).toBeDefined();
      expect(connectionManager.isFailed).toBeDefined();
    });
  });

  describe('configuration methods', () => {
    it('должен возвращать пустую конфигурацию соединения', () => {
      const config = connectionManager.getConnectionConfiguration();

      expect(config).toBeUndefined();
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

  describe('getUri', () => {
    it('должен возвращать правильный SIP URL', () => {
      const id = 'testuser';
      const result = connectionManager.getUri(id);

      expect(result).toBe(id);
    });
  });

  describe('getUaProtected', () => {
    it('должен выбрасывать ошибку, когда UA не инициализирован', () => {
      expect(() => {
        connectionManager.getUaProtected();
      }).toThrow('UA not initialized');
    });

    it('должен возвращать UA, когда он инициализирован', async () => {
      await connectionManager.connect(parameters);

      expect(() => {
        const ua = connectionManager.getUaProtected();

        expect(ua).toBe(connectionManager.ua);
      }).not.toThrow();
    });
  });

  describe('getUser', () => {
    it('должен возвращать undefined, когда UA не инициализирован', () => {
      expect(connectionManager.getUser()).toBeUndefined();
    });

    it('должен возвращать user из UA configuration, когда UA инициализирован', async () => {
      await connectionManager.connect(parameters);

      const user = connectionManager.getUser();

      expect(user).toBe(connectionManager.ua?.configuration.uri.user);
      expect(user).toBeDefined();
    });

    it('должен возвращать undefined при ошибке получения UA', () => {
      // Мокаем getUaProtected чтобы он выбрасывал ошибку
      jest.spyOn(connectionManager, 'getUaProtected').mockImplementation(() => {
        throw new Error('UA not initialized');
      });

      expect(connectionManager.getUser()).toBeUndefined();
    });
  });
});
