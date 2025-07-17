import type { UA } from '@krivega/jssip';
import ConfigurationManager, { type IConnectionConfiguration } from '../ConfigurationManager';

describe('ConfigurationManager', () => {
  let configurationManager: ConfigurationManager;
  let mockUa: UA | undefined;
  let mockGetUa: jest.MockedFunction<() => UA | undefined>;

  beforeEach(() => {
    mockUa = undefined;
    mockGetUa = jest.fn(() => {
      return mockUa;
    });

    configurationManager = new ConfigurationManager({
      getUa: mockGetUa,
    });
  });

  describe('Конструктор', () => {
    it('должен создавать экземпляр с зависимостями', () => {
      expect(configurationManager).toBeInstanceOf(ConfigurationManager);
    });
  });

  describe('isConfigured', () => {
    it('должен возвращать false когда UA не определен', () => {
      mockUa = undefined;
      mockGetUa.mockReturnValue(mockUa);

      expect(configurationManager.isConfigured()).toBe(false);
      expect(mockGetUa).toHaveBeenCalledTimes(1);
    });

    it('должен возвращать true когда UA определен', () => {
      mockUa = {} as UA;
      mockGetUa.mockReturnValue(mockUa);

      expect(configurationManager.isConfigured()).toBe(true);
      expect(mockGetUa).toHaveBeenCalledTimes(1);
    });

    it('должен вызывать функцию getUa', () => {
      configurationManager.isConfigured();

      expect(mockGetUa).toHaveBeenCalledTimes(1);
    });
  });

  describe('getConnectionConfiguration', () => {
    it('должен возвращать пустую конфигурацию по умолчанию', () => {
      const config = configurationManager.getConnectionConfiguration();

      expect(config).toEqual({});
    });

    it('должен возвращать копию конфигурации, а не ссылку', () => {
      const testConfig: IConnectionConfiguration = {
        sipServerUrl: 'sip:test.com',
        displayName: 'Test User',
        register: true,
        user: 'testuser',
        password: 'testpass',
      };

      configurationManager.setConnectionConfiguration(testConfig);

      const config1 = configurationManager.getConnectionConfiguration();
      const config2 = configurationManager.getConnectionConfiguration();

      expect(config1).toEqual(testConfig);
      expect(config2).toEqual(testConfig);
      expect(config1).not.toBe(config2); // Different objects
    });
  });

  describe('setConnectionConfiguration', () => {
    it('должен устанавливать конфигурацию корректно', () => {
      const testConfig: IConnectionConfiguration = {
        sipServerUrl: 'sip:test.com',
        displayName: 'Test User',
        register: true,
        user: 'testuser',
        password: 'testpass',
      };

      configurationManager.setConnectionConfiguration(testConfig);

      expect(configurationManager.getConnectionConfiguration()).toEqual(testConfig);
    });

    it('должен перезаписывать существующую конфигурацию', () => {
      const config1: IConnectionConfiguration = {
        sipServerUrl: 'sip:old.com',
        displayName: 'Old User',
      };

      const config2: IConnectionConfiguration = {
        sipServerUrl: 'sip:new.com',
        displayName: 'New User',
        register: true,
      };

      configurationManager.setConnectionConfiguration(config1);
      configurationManager.setConnectionConfiguration(config2);

      expect(configurationManager.getConnectionConfiguration()).toEqual(config2);
    });

    it('должен обрабатывать частичную конфигурацию', () => {
      const partialConfig: IConnectionConfiguration = {
        sipServerUrl: 'sip:test.com',
        register: false,
      };

      configurationManager.setConnectionConfiguration(partialConfig);

      const result = configurationManager.getConnectionConfiguration();

      expect(result.sipServerUrl).toBe('sip:test.com');
      expect(result.register).toBe(false);
      expect(result.displayName).toBeUndefined();
      expect(result.user).toBeUndefined();
      expect(result.password).toBeUndefined();
    });
  });

  describe('isRegister', () => {
    it('должен возвращать false когда register не определен', () => {
      configurationManager.setConnectionConfiguration({});

      expect(configurationManager.isRegister()).toBe(false);
    });

    it('должен возвращать false когда register равен false', () => {
      configurationManager.setConnectionConfiguration({ register: false });

      expect(configurationManager.isRegister()).toBe(false);
    });

    it('должен возвращать true когда register равен true', () => {
      configurationManager.setConnectionConfiguration({ register: true });

      expect(configurationManager.isRegister()).toBe(true);
    });

    it('должен возвращать false когда register явно установлен в false', () => {
      configurationManager.setConnectionConfiguration({ register: false });

      expect(configurationManager.isRegister()).toBe(false);
    });
  });

  describe('getSipServerUrl', () => {
    it('должен возвращать undefined когда не установлен', () => {
      expect(configurationManager.getSipServerUrl()).toBeUndefined();
    });

    it('должен возвращать sipServerUrl когда установлен', () => {
      const testUrl = 'sip:test.com';

      configurationManager.setConnectionConfiguration({ sipServerUrl: testUrl });

      expect(configurationManager.getSipServerUrl()).toBe(testUrl);
    });
  });

  describe('getDisplayName', () => {
    it('должен возвращать undefined когда не установлен', () => {
      expect(configurationManager.getDisplayName()).toBeUndefined();
    });

    it('должен возвращать displayName когда установлен', () => {
      const testName = 'Test User';

      configurationManager.setConnectionConfiguration({ displayName: testName });

      expect(configurationManager.getDisplayName()).toBe(testName);
    });
  });

  describe('getUser', () => {
    it('должен возвращать undefined когда не установлен', () => {
      expect(configurationManager.getUser()).toBeUndefined();
    });

    it('должен возвращать user когда установлен', () => {
      const testUser = 'testuser';

      configurationManager.setConnectionConfiguration({ user: testUser });

      expect(configurationManager.getUser()).toBe(testUser);
    });
  });

  describe('getPassword', () => {
    it('должен возвращать undefined когда не установлен', () => {
      expect(configurationManager.getPassword()).toBeUndefined();
    });

    it('должен возвращать password когда установлен', () => {
      const testPassword = 'testpass';

      configurationManager.setConnectionConfiguration({ password: testPassword });

      expect(configurationManager.getPassword()).toBe(testPassword);
    });
  });

  describe('isRegisterEnabled', () => {
    it('должен возвращать false когда register не определен', () => {
      configurationManager.setConnectionConfiguration({});

      expect(configurationManager.isRegisterEnabled()).toBe(false);
    });

    it('должен возвращать false когда register равен false', () => {
      configurationManager.setConnectionConfiguration({ register: false });

      expect(configurationManager.isRegisterEnabled()).toBe(false);
    });

    it('должен возвращать true когда register равен true', () => {
      configurationManager.setConnectionConfiguration({ register: true });

      expect(configurationManager.isRegisterEnabled()).toBe(true);
    });

    it('должен быть идентичен методу isRegister', () => {
      configurationManager.setConnectionConfiguration({ register: true });

      expect(configurationManager.isRegisterEnabled()).toBe(configurationManager.isRegister());
    });
  });

  describe('clearConfiguration', () => {
    it('должен очищать всю конфигурацию', () => {
      const testConfig: IConnectionConfiguration = {
        sipServerUrl: 'sip:test.com',
        displayName: 'Test User',
        register: true,
        user: 'testuser',
        password: 'testpass',
      };

      configurationManager.setConnectionConfiguration(testConfig);
      configurationManager.clearConfiguration();

      expect(configurationManager.getConnectionConfiguration()).toEqual({});
    });

    it('должен очищать конфигурацию до пустого объекта', () => {
      configurationManager.setConnectionConfiguration({
        sipServerUrl: 'sip:test.com',
        displayName: 'Test User',
      });

      configurationManager.clearConfiguration();

      const config = configurationManager.getConnectionConfiguration();

      expect(config).toEqual({});
      expect(config.sipServerUrl).toBeUndefined();
      expect(config.displayName).toBeUndefined();
    });
  });

  describe('Интеграционные сценарии', () => {
    it('должен обрабатывать полный жизненный цикл конфигурации', () => {
      // Начальное состояние
      expect(configurationManager.isConfigured()).toBe(false);
      expect(configurationManager.getConnectionConfiguration()).toEqual({});

      // Устанавливаем конфигурацию
      const fullConfig: IConnectionConfiguration = {
        sipServerUrl: 'sip:example.com',
        displayName: 'John Doe',
        register: true,
        user: 'johndoe',
        password: 'secret123',
      };

      configurationManager.setConnectionConfiguration(fullConfig);

      // Проверяем все геттеры
      expect(configurationManager.getSipServerUrl()).toBe('sip:example.com');
      expect(configurationManager.getDisplayName()).toBe('John Doe');
      expect(configurationManager.getUser()).toBe('johndoe');
      expect(configurationManager.getPassword()).toBe('secret123');
      expect(configurationManager.isRegister()).toBe(true);
      expect(configurationManager.isRegisterEnabled()).toBe(true);

      // Очищаем и проверяем
      configurationManager.clearConfiguration();
      expect(configurationManager.getConnectionConfiguration()).toEqual({});
      expect(configurationManager.isRegister()).toBe(false);
    });

    it('должен обрабатывать обновления конфигурации', () => {
      // Устанавливаем начальную конфигурацию
      configurationManager.setConnectionConfiguration({
        sipServerUrl: 'sip:old.com',
        displayName: 'Old User',
        register: false,
      });

      // Обновляем конфигурацию
      configurationManager.setConnectionConfiguration({
        sipServerUrl: 'sip:new.com',
        displayName: 'New User',
        register: true,
        user: 'newuser',
        password: 'newpass',
      });

      // Проверяем обновленные значения
      expect(configurationManager.getSipServerUrl()).toBe('sip:new.com');
      expect(configurationManager.getDisplayName()).toBe('New User');
      expect(configurationManager.getUser()).toBe('newuser');
      expect(configurationManager.getPassword()).toBe('newpass');
      expect(configurationManager.isRegister()).toBe(true);
    });

    it('должен обрабатывать изменения состояния UA', () => {
      // Изначально нет UA
      expect(configurationManager.isConfigured()).toBe(false);

      // Устанавливаем UA
      mockUa = {} as UA;
      mockGetUa.mockReturnValue(mockUa);

      expect(configurationManager.isConfigured()).toBe(true);

      // Удаляем UA
      mockUa = undefined;
      mockGetUa.mockReturnValue(mockUa);

      expect(configurationManager.isConfigured()).toBe(false);
    });
  });

  describe('Граничные случаи', () => {
    it('должен обрабатывать пустые строковые значения', () => {
      configurationManager.setConnectionConfiguration({
        sipServerUrl: '',
        displayName: '',
        user: '',
        password: '',
        register: false,
      });

      expect(configurationManager.getSipServerUrl()).toBe('');
      expect(configurationManager.getDisplayName()).toBe('');
      expect(configurationManager.getUser()).toBe('');
      expect(configurationManager.getPassword()).toBe('');
      expect(configurationManager.isRegister()).toBe(false);
    });

    it('должен обрабатывать null/undefined значения в конфигурации', () => {
      configurationManager.setConnectionConfiguration({
        sipServerUrl: undefined,
        displayName: undefined,
        user: undefined,
        password: undefined,
        register: undefined,
      });

      expect(configurationManager.getSipServerUrl()).toBeUndefined();
      expect(configurationManager.getDisplayName()).toBeUndefined();
      expect(configurationManager.getUser()).toBeUndefined();
      expect(configurationManager.getPassword()).toBeUndefined();
      expect(configurationManager.isRegister()).toBe(false);
    });

    it('должен обрабатывать множественные операции очистки', () => {
      configurationManager.setConnectionConfiguration({
        sipServerUrl: 'sip:test.com',
        displayName: 'Test User',
      });

      configurationManager.clearConfiguration();
      configurationManager.clearConfiguration();
      configurationManager.clearConfiguration();

      expect(configurationManager.getConnectionConfiguration()).toEqual({});
    });

    it('должен обрабатывать множественные вызовы функции getUa', () => {
      configurationManager.isConfigured();
      configurationManager.isConfigured();
      configurationManager.isConfigured();

      expect(mockGetUa).toHaveBeenCalledTimes(3);
    });
  });
});
