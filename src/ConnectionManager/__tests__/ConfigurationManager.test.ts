import type { UA, WebSocketInterface } from '@krivega/jssip';
import UAMock from '../../__fixtures__/UA.mock';
import type { IConnectionConfiguration } from '../ConfigurationManager';
import ConfigurationManager from '../ConfigurationManager';

describe('ConfigurationManager', () => {
  let configurationManager: ConfigurationManager;
  let mockUa: UAMock;
  let getUaMock: jest.MockedFunction<() => UA | undefined>;

  beforeEach(() => {
    // Создаем мок UA с правильной конфигурацией
    mockUa = new UAMock({
      uri: 'sip:testuser@test.com',
      register: false,
      sockets: [
        {
          url: 'wss://test.com/webrtc/wss/',
          sip_uri: 'sip:test.com;transport=ws',
          via_transport: 'WSS',
        } as unknown as WebSocketInterface,
      ],
    });

    // Создаем мок функции getUa
    getUaMock = jest.fn(() => {
      return mockUa as unknown as UA;
    });

    // Создаем экземпляр ConfigurationManager
    configurationManager = new ConfigurationManager({
      getUa: getUaMock,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Конструктор', () => {
    it('должен создавать экземпляр с зависимостями', () => {
      expect(configurationManager).toBeInstanceOf(ConfigurationManager);
    });
  });

  describe('isConfigured', () => {
    it('должен возвращать true когда UA настроен', () => {
      expect(configurationManager.isConfigured()).toBe(true);
      expect(getUaMock).toHaveBeenCalledTimes(1);
    });

    it('должен возвращать false когда UA не настроен', () => {
      getUaMock.mockReturnValue(undefined);

      expect(configurationManager.isConfigured()).toBe(false);
      expect(getUaMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('getConnectionConfiguration', () => {
    it('должен возвращать пустую конфигурацию по умолчанию', () => {
      const config = configurationManager.getConnectionConfiguration();

      expect(config).toEqual({});
    });

    it('должен возвращать копию конфигурации', () => {
      const testConfig: IConnectionConfiguration = {
        sipServerUrl: 'sip.test.com',
        displayName: 'Test User',
        register: true,
        user: 'testuser',
        password: 'testpass',
      };

      configurationManager.setConnectionConfiguration(testConfig);

      const config = configurationManager.getConnectionConfiguration();

      expect(config).toEqual(testConfig);
      expect(config).not.toBe(testConfig); // Должна быть копия
    });
  });

  describe('setConnectionConfiguration', () => {
    it('должен устанавливать конфигурацию', () => {
      const testConfig: IConnectionConfiguration = {
        sipServerUrl: 'sip.test.com',
        displayName: 'Test User',
        register: true,
        user: 'testuser',
        password: 'testpass',
      };

      configurationManager.setConnectionConfiguration(testConfig);

      expect(configurationManager.getConnectionConfiguration()).toEqual(testConfig);
    });

    it('должен перезаписывать существующую конфигурацию', () => {
      const initialConfig: IConnectionConfiguration = {
        sipServerUrl: 'old.test.com',
        displayName: 'Old User',
      };

      const newConfig: IConnectionConfiguration = {
        sipServerUrl: 'new.test.com',
        displayName: 'New User',
        register: true,
      };

      configurationManager.setConnectionConfiguration(initialConfig);
      configurationManager.setConnectionConfiguration(newConfig);

      expect(configurationManager.getConnectionConfiguration()).toEqual(newConfig);
    });
  });

  describe('isRegister', () => {
    it('должен возвращать false когда регистрация не включена', () => {
      expect(configurationManager.isRegister()).toBe(false);
    });

    it('должен возвращать true когда регистрация включена', () => {
      configurationManager.setConnectionConfiguration({ register: true });

      expect(configurationManager.isRegister()).toBe(true);
    });

    it('должен возвращать false когда register установлен в false', () => {
      configurationManager.setConnectionConfiguration({ register: false });

      expect(configurationManager.isRegister()).toBe(false);
    });
  });

  describe('getSipServerUrl', () => {
    it('должен возвращать undefined когда URL не установлен', () => {
      expect(configurationManager.getSipServerUrl()).toBeUndefined();
    });

    it('должен возвращать SIP сервер URL', () => {
      const serverUrl = 'sip.test.com';

      configurationManager.setConnectionConfiguration({ sipServerUrl: serverUrl });

      expect(configurationManager.getSipServerUrl()).toBe(serverUrl);
    });
  });

  describe('getDisplayName', () => {
    it('должен возвращать undefined когда display name не установлен', () => {
      expect(configurationManager.getDisplayName()).toBeUndefined();
    });

    it('должен возвращать display name', () => {
      const displayName = 'Test User';

      configurationManager.setConnectionConfiguration({ displayName });

      expect(configurationManager.getDisplayName()).toBe(displayName);
    });
  });

  describe('getUser', () => {
    it('должен возвращать undefined когда пользователь не установлен', () => {
      expect(configurationManager.getUser()).toBeUndefined();
    });

    it('должен возвращать пользователя', () => {
      const user = 'testuser';

      configurationManager.setConnectionConfiguration({ user });

      expect(configurationManager.getUser()).toBe(user);
    });
  });

  describe('getPassword', () => {
    it('должен возвращать undefined когда пароль не установлен', () => {
      expect(configurationManager.getPassword()).toBeUndefined();
    });

    it('должен возвращать пароль', () => {
      const password = 'testpass';

      configurationManager.setConnectionConfiguration({ password });

      expect(configurationManager.getPassword()).toBe(password);
    });
  });

  describe('isRegisterEnabled', () => {
    it('должен возвращать false когда регистрация не включена', () => {
      expect(configurationManager.isRegisterEnabled()).toBe(false);
    });

    it('должен возвращать true когда регистрация включена', () => {
      configurationManager.setConnectionConfiguration({ register: true });

      expect(configurationManager.isRegisterEnabled()).toBe(true);
    });

    it('должен возвращать false когда register установлен в false', () => {
      configurationManager.setConnectionConfiguration({ register: false });

      expect(configurationManager.isRegisterEnabled()).toBe(false);
    });
  });

  describe('clearConfiguration', () => {
    it('должен очищать конфигурацию', () => {
      const testConfig: IConnectionConfiguration = {
        sipServerUrl: 'sip.test.com',
        displayName: 'Test User',
        register: true,
        user: 'testuser',
        password: 'testpass',
      };

      configurationManager.setConnectionConfiguration(testConfig);
      configurationManager.clearConfiguration();

      expect(configurationManager.getConnectionConfiguration()).toEqual({});
    });

    it('должен очищать все поля конфигурации', () => {
      const testConfig: IConnectionConfiguration = {
        sipServerUrl: 'sip.test.com',
        displayName: 'Test User',
        register: true,
        user: 'testuser',
        password: 'testpass',
      };

      configurationManager.setConnectionConfiguration(testConfig);
      configurationManager.clearConfiguration();

      expect(configurationManager.getSipServerUrl()).toBeUndefined();
      expect(configurationManager.getDisplayName()).toBeUndefined();
      expect(configurationManager.getUser()).toBeUndefined();
      expect(configurationManager.getPassword()).toBeUndefined();
      expect(configurationManager.isRegister()).toBe(false);
      expect(configurationManager.isRegisterEnabled()).toBe(false);
    });
  });

  describe('Интеграционные сценарии', () => {
    it('должен корректно обрабатывать полную конфигурацию', () => {
      const fullConfig: IConnectionConfiguration = {
        sipServerUrl: 'sip.test.com',
        displayName: 'Test User',
        register: true,
        user: 'testuser',
        password: 'testpass',
      };

      configurationManager.setConnectionConfiguration(fullConfig);

      expect(configurationManager.getSipServerUrl()).toBe('sip.test.com');
      expect(configurationManager.getDisplayName()).toBe('Test User');
      expect(configurationManager.getUser()).toBe('testuser');
      expect(configurationManager.getPassword()).toBe('testpass');
      expect(configurationManager.isRegister()).toBe(true);
      expect(configurationManager.isRegisterEnabled()).toBe(true);
    });

    it('должен корректно обрабатывать частичную конфигурацию', () => {
      const partialConfig: IConnectionConfiguration = {
        sipServerUrl: 'sip.test.com',
        displayName: 'Test User',
      };

      configurationManager.setConnectionConfiguration(partialConfig);

      expect(configurationManager.getSipServerUrl()).toBe('sip.test.com');
      expect(configurationManager.getDisplayName()).toBe('Test User');
      expect(configurationManager.getUser()).toBeUndefined();
      expect(configurationManager.getPassword()).toBeUndefined();
      expect(configurationManager.isRegister()).toBe(false);
      expect(configurationManager.isRegisterEnabled()).toBe(false);
    });

    it('должен корректно работать с пустой конфигурацией', () => {
      const emptyConfig: IConnectionConfiguration = {};

      configurationManager.setConnectionConfiguration(emptyConfig);

      expect(configurationManager.getSipServerUrl()).toBeUndefined();
      expect(configurationManager.getDisplayName()).toBeUndefined();
      expect(configurationManager.getUser()).toBeUndefined();
      expect(configurationManager.getPassword()).toBeUndefined();
      expect(configurationManager.isRegister()).toBe(false);
      expect(configurationManager.isRegisterEnabled()).toBe(false);
    });
  });

  describe('Граничные случаи', () => {
    it('должен корректно обрабатывать пустые строки', () => {
      const configWithEmptyStrings: IConnectionConfiguration = {
        sipServerUrl: '',
        displayName: '',
        user: '',
        password: '',
      };

      configurationManager.setConnectionConfiguration(configWithEmptyStrings);

      expect(configurationManager.getSipServerUrl()).toBe('');
      expect(configurationManager.getDisplayName()).toBe('');
      expect(configurationManager.getUser()).toBe('');
      expect(configurationManager.getPassword()).toBe('');
    });

    it('должен корректно обрабатывать undefined значения', () => {
      const configWithUndefined: IConnectionConfiguration = {
        sipServerUrl: undefined,
        displayName: undefined,
        user: undefined,
        password: undefined,
        register: undefined,
      };

      configurationManager.setConnectionConfiguration(configWithUndefined);

      expect(configurationManager.getSipServerUrl()).toBeUndefined();
      expect(configurationManager.getDisplayName()).toBeUndefined();
      expect(configurationManager.getUser()).toBeUndefined();
      expect(configurationManager.getPassword()).toBeUndefined();
      expect(configurationManager.isRegister()).toBe(false);
      expect(configurationManager.isRegisterEnabled()).toBe(false);
    });

    it('должен корректно обрабатывать множественные вызовы getUa', () => {
      configurationManager.isConfigured();
      configurationManager.isConfigured();
      configurationManager.isConfigured();

      expect(getUaMock).toHaveBeenCalledTimes(3);
    });
  });
});
