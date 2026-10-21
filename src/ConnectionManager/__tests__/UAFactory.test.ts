import { UA as RealUA, WebSocketInterface } from '@krivega/jssip';

import jssip from '@/__fixtures__/jssip.mock';
import * as utils from '@/utils/utils';
import { createEvents } from '../events';
import UAFactory from '../UAFactory';

import type { Socket, UA } from '@krivega/jssip';
import type { TJsSIP } from '@/types';

describe('UAFactory', () => {
  let uaFactory: UAFactory;

  beforeEach(() => {
    uaFactory = new UAFactory(jssip as unknown as TJsSIP);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('конструктор', () => {
    it('должен создавать экземпляр с переданным JsSIP', () => {
      expect(uaFactory).toBeInstanceOf(UAFactory);
    });
  });

  describe('isRegisteredUA', () => {
    it('должен возвращать false для undefined UA', () => {
      expect(UAFactory.isRegisteredUA(undefined)).toBe(false);
    });

    it('должен возвращать false для null UA', () => {
      expect(UAFactory.isRegisteredUA(undefined)).toBe(false);
    });

    it('должен возвращать true для зарегистрированного UA', () => {
      const mockUA = {
        isRegistered: () => {
          return true;
        },
      } as unknown as UA;

      expect(UAFactory.isRegisteredUA(mockUA)).toBe(true);
    });

    it('должен возвращать false для незарегистрированного UA', () => {
      const mockUA = {
        isRegistered: () => {
          return false;
        },
      } as unknown as UA;

      expect(UAFactory.isRegisteredUA(mockUA)).toBe(false);
    });
  });

  describe('createConfiguration', () => {
    const baseParameters = {
      sipServerIp: 'sip.example.com',
      sipServerUrl: 'wss://sip.example.com:8089/ws',
      user: 'testuser',
      password: 'testpass',
      displayName: 'Test User',
      register: true,
    };

    it('должен создавать конфигурацию с базовыми параметрами', () => {
      const config = uaFactory.createConfiguration(baseParameters);

      expect(config.configuration).toMatchObject({
        password: 'testpass',
        register: true,
        display_name: 'Test_User', // parseDisplayName заменяет пробелы на подчеркивания
        session_timers: false,
        register_expires: 300,
        connection_recovery_min_interval: 2,
        connection_recovery_max_interval: 6,
      });

      expect(config.helpers.socket).toBeDefined();
      expect(config.helpers.getUri).toBeDefined();
    });

    it('должен создавать конфигурацию без регистрации', () => {
      const config = uaFactory.createConfiguration({
        ...baseParameters,
        register: false,
        user: undefined,
        password: undefined,
      });

      expect(config.configuration.register).toBe(false);
      expect(config.configuration.password).toBeUndefined();
    });

    it('должен генерировать authorizationUser при отсутствии user и register=false', () => {
      const config = uaFactory.createConfiguration({
        ...baseParameters,
        register: false,
        user: undefined,
      });

      expect(config.configuration.uri).toContain('sip:');
      expect(config.configuration.uri).not.toContain('testuser');
    });

    it('должен использовать переданный user для authorizationUser', () => {
      const config = uaFactory.createConfiguration({
        ...baseParameters,
        user: 'customuser',
      });

      expect(config.configuration.uri).toContain('customuser');
    });

    it.each([
      {
        title: 'использовать userId без регистрации даже при переданном user',
        register: false,
        user: 'testuser',
        userId: 'guest-user',
        authorizationUser: 'guest-user',
      },
      {
        title: 'сохранять пустой userId без генерации идентификатора',
        register: false,
        user: undefined,
        userId: '',
        authorizationUser: '',
      },
      {
        title: 'использовать user при регистрации с переданным userId',
        register: true,
        user: ' testuser ',
        userId: 'guest-user',
        authorizationUser: 'testuser',
      },
      {
        title: 'использовать userId при регистрации с user из пробелов',
        register: true,
        user: '   ',
        userId: 'guest-user',
        authorizationUser: 'guest-user',
      },
    ])('должен $title', ({ authorizationUser, register, user, userId }) => {
      const generateUserIdSpy = jest.spyOn(utils, 'generateUserId');
      const config = uaFactory.createConfiguration({
        ...baseParameters,
        register,
        user,
        userId,
      });

      expect(config.configuration.uri).toBe(`sip:${authorizationUser}@sip.example.com`);
      expect(generateUserIdSpy).not.toHaveBeenCalled();
    });

    it('должен обрабатывать пустой displayName', () => {
      const config = uaFactory.createConfiguration({
        ...baseParameters,
        displayName: '',
      });

      expect(config.configuration.display_name).toBe('');
    });

    it('должен использовать пустую строку как значение по умолчанию для displayName', () => {
      const config = uaFactory.createConfiguration({
        sipServerIp: baseParameters.sipServerIp,
        sipServerUrl: baseParameters.sipServerUrl,
        user: baseParameters.user,
        password: baseParameters.password,
        register: baseParameters.register,
        // @ts-expect-error
        displayName: undefined, // Принудительно передаем undefined для тестирования дефолта
      });

      expect(config.configuration.display_name).toBe('');
    });

    it('должен обрабатывать userAgent', () => {
      const config = uaFactory.createConfiguration({
        ...baseParameters,
        userAgent: 'Custom User Agent',
      });

      expect(config.configuration.user_agent).toBe('Custom User Agent');
    });

    it('должен формировать contact_uri с заданным contactUserId', () => {
      const contactUserId = 'contact-user';
      const config = uaFactory.createConfiguration({
        ...baseParameters,
        contactUserId,
      });

      expect(config.configuration.contact_uri).toMatch(
        /^sip:contact-user@[\da-v]{12}\.invalid;transport=ws$/,
      );
      expect(config.configuration.uri).toBe('sip:testuser@sip.example.com');
    });

    it('должен оставлять Contact на усмотрение JsSIP без contactUserId', () => {
      const config = uaFactory.createConfiguration(baseParameters);

      expect(config.configuration).not.toHaveProperty('contact_uri');
    });

    it.each([
      { randomValue: 0, expectedHost: '000000000000.invalid' },
      { randomValue: 0.5, expectedHost: 'gggggggggggg.invalid' },
      { randomValue: 0.999999, expectedHost: 'vvvvvvvvvvvv.invalid' },
    ])('должен генерировать хост как JsSIP: $expectedHost', ({ randomValue, expectedHost }) => {
      jest.spyOn(Math, 'random').mockReturnValue(randomValue);

      const config = uaFactory.createConfiguration({
        ...baseParameters,
        contactUserId: 'test123',
      });

      expect(config.configuration.contact_uri).toBe(`sip:test123@${expectedHost};transport=ws`);
    });

    it('должен обрабатывать sessionTimers', () => {
      const config = uaFactory.createConfiguration({
        ...baseParameters,
        sessionTimers: true,
      });

      expect(config.configuration.session_timers).toBe(true);
    });

    it('должен обрабатывать registerExpires', () => {
      const config = uaFactory.createConfiguration({
        ...baseParameters,
        registerExpires: 600,
      });

      expect(config.configuration.register_expires).toBe(600);
    });

    it('должен обрабатывать connectionRecoveryMinInterval', () => {
      const config = uaFactory.createConfiguration({
        ...baseParameters,
        connectionRecoveryMinInterval: 5,
      });

      expect(config.configuration.connection_recovery_min_interval).toBe(5);
    });

    it('должен обрабатывать connectionRecoveryMaxInterval', () => {
      const config = uaFactory.createConfiguration({
        ...baseParameters,
        connectionRecoveryMaxInterval: 10,
      });

      expect(config.configuration.connection_recovery_max_interval).toBe(10);
    });

    describe('валидация конфигурации', () => {
      it('должен выбрасывать ошибку при отсутствии sipServerIp', () => {
        expect(() => {
          uaFactory.createConfiguration({
            ...baseParameters,
            sipServerIp: '',
          });
        }).toThrow('sipServerIp is required');
      });

      it('должен выбрасывать ошибку при отсутствии sipServerUrl', () => {
        expect(() => {
          uaFactory.createConfiguration({
            ...baseParameters,
            sipServerUrl: '',
          });
        }).toThrow('sipServerUrl is required');
      });

      it('должен выбрасывать ошибку при регистрации без пароля', () => {
        expect(() => {
          uaFactory.createConfiguration({
            ...baseParameters,
            password: '',
          });
        }).toThrow('password is required for authorized connection');
      });

      it('должен выбрасывать ошибку при регистрации без пользователя', () => {
        expect(() => {
          uaFactory.createConfiguration({
            ...baseParameters,
            user: '',
          });
        }).toThrow('user is required for authorized connection');
      });

      it('должен выбрасывать ошибку при регистрации с undefined паролем', () => {
        expect(() => {
          uaFactory.createConfiguration({
            ...baseParameters,
            password: undefined,
          });
        }).toThrow('password is required for authorized connection');
      });

      it('должен выбрасывать ошибку при регистрации с undefined пользователем', () => {
        expect(() => {
          uaFactory.createConfiguration({
            ...baseParameters,
            user: undefined,
          });
        }).toThrow('user is required for authorized connection');
      });

      it('не должен выбрасывать ошибку при отсутствии регистрации', () => {
        expect(() => {
          uaFactory.createConfiguration({
            ...baseParameters,
            register: false,
            password: undefined,
            user: undefined,
          });
        }).not.toThrow();
      });
    });
  });

  describe('createUA', () => {
    const baseParameters = {
      uri: 'sip:testuser@sip.example.com',
      password: 'testpass',
      register: true,
      display_name: 'Test User',
      sockets: [{}] as unknown as Socket,
    };

    it('должен создавать UA с базовыми параметрами', () => {
      const ua = uaFactory.createUA(baseParameters);

      expect(ua).toBeDefined();
      expect(ua).toBeInstanceOf(jssip.UA);
    });

    it('должен создавать UA с remoteAddress', () => {
      const ua = uaFactory.createUA({
        ...baseParameters,
        remoteAddress: '192.168.1.1',
      });

      expect(ua).toBeDefined();
    });

    it('должен создавать UA с extraHeaders', () => {
      const ua = uaFactory.createUA({
        ...baseParameters,
        extraHeaders: ['X-Custom-Header: value'],
      });

      expect(ua).toBeDefined();
    });

    it('должен создавать UA с remoteAddress и extraHeaders', () => {
      const ua = uaFactory.createUA({
        ...baseParameters,
        remoteAddress: '192.168.1.1',
        extraHeaders: ['X-Custom-Header: value'],
      });

      expect(ua).toBeDefined();
    });

    it('должен создавать UA без extraHeaders', () => {
      const ua = uaFactory.createUA({
        ...baseParameters,
        remoteAddress: '192.168.1.1',
      });

      expect(ua).toBeDefined();
    });

    it('должен создавать UA с пустым remoteAddress', () => {
      const ua = uaFactory.createUA({
        ...baseParameters,
        remoteAddress: '',
      });

      expect(ua).toBeDefined();
    });

    it('должен создавать UA с undefined remoteAddress', () => {
      const ua = uaFactory.createUA({
        ...baseParameters,
        remoteAddress: undefined,
      });

      expect(ua).toBeDefined();
    });
  });

  describe('createUAWithConfiguration', () => {
    const baseParameters = {
      sipServerIp: 'sip.example.com',
      sipServerUrl: 'wss://sip.example.com:8089/ws',
      user: 'testuser',
      password: 'testpass',
      displayName: 'Test User',
      register: true,
    };

    it('должен создавать UA с конфигурацией и событиями', () => {
      const events = {
        eachTriggers: (
          callback: (trigger: (...args: unknown[]) => void, eventName: string) => void,
        ) => {
          callback(() => {}, 'connected');
          callback(() => {}, 'disconnected');
        },
      };

      const result = uaFactory.createUAWithConfiguration(baseParameters, events);

      expect(result.ua).toBeDefined();
      expect(result.ua).toBeInstanceOf(jssip.UA);
      expect(result.helpers.socket).toBeDefined();
      expect(result.helpers.getUri).toBeDefined();
    });

    it('должен создавать UA с remoteAddress', () => {
      const events = {
        eachTriggers: (
          callback: (trigger: (...args: unknown[]) => void, eventName: string) => void,
        ) => {
          callback(() => {}, 'connected');
          callback(() => {}, 'disconnected');
        },
      };
      const result = uaFactory.createUAWithConfiguration(
        {
          ...baseParameters,
          remoteAddress: '192.168.1.1',
        },
        events,
      );

      expect(result.ua).toBeDefined();
      expect(result.helpers.socket).toBeDefined();
    });

    it('должен создавать UA с extraHeaders', () => {
      const events = {
        eachTriggers: (
          callback: (trigger: (...args: unknown[]) => void, eventName: string) => void,
        ) => {
          callback(() => {}, 'connected');
          callback(() => {}, 'disconnected');
        },
      };
      const result = uaFactory.createUAWithConfiguration(
        {
          ...baseParameters,
          extraHeaders: ['X-Custom-Header: value'],
        },
        events,
      );

      expect(result.ua).toBeDefined();
      expect(result.helpers.socket).toBeDefined();
    });

    it('должен создавать UA с remoteAddress и extraHeaders', () => {
      const events = {
        eachTriggers: (
          callback: (trigger: (...args: unknown[]) => void, eventName: string) => void,
        ) => {
          callback(() => {}, 'connected');
          callback(() => {}, 'disconnected');
        },
      };
      const result = uaFactory.createUAWithConfiguration(
        {
          ...baseParameters,
          remoteAddress: '192.168.1.1',
          extraHeaders: ['X-Custom-Header: value'],
        },
        events,
      );

      expect(result.ua).toBeDefined();
      expect(result.helpers.socket).toBeDefined();
    });

    it('должен обрабатывать события только для валидных JsSIP событий', () => {
      const events = {
        eachTriggers: (
          callback: (trigger: (...args: unknown[]) => void, eventName: string) => void,
        ) => {
          callback(() => {}, 'connected'); // Валидное событие
          callback(() => {}, 'invalidEvent'); // Невалидное событие
        },
      };

      const result = uaFactory.createUAWithConfiguration(baseParameters, events);

      expect(result.ua).toBeDefined();
      // Невалидное событие не должно быть зарегистрировано
    });
  });

  describe('интеграционные тесты', () => {
    const realUaFactory = new UAFactory({ UA: RealUA, WebSocketInterface });
    const realUaParameters = {
      displayName: 'Test User',
      sipServerIp: 'sip.example.com',
      sipServerUrl: 'sip.example.com',
      user: 'registered-user',
      password: 'testpass',
      userId: 'from-user',
    };

    it.each([false, true])(
      'должен формировать Contact в настоящем JsSIP при register=%s',
      (register) => {
        const contactUserId = 'test123';
        const { ua } = realUaFactory.createUAWithConfiguration(
          { ...realUaParameters, register, contactUserId },
          createEvents(),
        );

        expect(ua.contact.uri?.user).toBe(contactUserId);
        expect(ua.contact.uri?.host).toMatch(/^[\da-v]{12}\.invalid$/);
        expect(ua.contact.uri?.getParam('transport')).toBe('ws');
        expect(ua.contact.toString({ outbound: true })).toMatch(
          /^<sip:test123@[\da-v]{12}\.invalid;transport=ws;ob>$/,
        );
        expect(ua.configuration.uri.user).toBe(register ? 'registered-user' : 'from-user');
      },
    );

    it('должен автоматически создавать Contact в настоящем JsSIP без contactUserId', () => {
      const { ua } = realUaFactory.createUAWithConfiguration(
        { ...realUaParameters, register: false },
        createEvents(),
      );

      expect(ua.contact.toString({ outbound: true })).toMatch(
        /^<sip:[\da-v]{8}@[\da-v]{12}\.invalid;transport=ws;ob>$/,
      );
      expect(ua.configuration.uri.user).toBe('from-user');
    });

    it('должен экранировать contactUserId без изменения хоста и транспорта', () => {
      const { ua } = realUaFactory.createUAWithConfiguration(
        { ...realUaParameters, register: false, contactUserId: 'test@123' },
        createEvents(),
      );

      expect(ua.contact.uri?.user).toBe('test@123');
      expect(ua.contact.toString({ outbound: true })).toMatch(
        /^<sip:test%40123@[\da-v]{12}\.invalid;transport=ws;ob>$/,
      );
    });

    it('должен создавать полную конфигурацию и UA', () => {
      const parameters = {
        sipServerIp: 'sip.example.com',
        sipServerUrl: 'wss://sip.example.com:8089/ws',
        user: 'testuser',
        password: 'testpass',
        displayName: 'Test User',
        register: true,
        sessionTimers: true,
        registerExpires: 600,
        connectionRecoveryMinInterval: 3,
        connectionRecoveryMaxInterval: 8,
        userAgent: 'Custom UA',
      };

      const config = uaFactory.createConfiguration(parameters);
      const ua = uaFactory.createUA({
        ...config.configuration,
        remoteAddress: '192.168.1.1',
        extraHeaders: ['X-Custom-Header: value'],
      });

      expect(config.configuration).toMatchObject({
        password: 'testpass',
        register: true,
        display_name: 'Test_User', // parseDisplayName заменяет пробелы на подчеркивания
        user_agent: 'Custom UA',
        session_timers: true,
        register_expires: 600,
        connection_recovery_min_interval: 3,
        connection_recovery_max_interval: 8,
      });

      expect(ua).toBeDefined();
      expect(ua).toBeInstanceOf(jssip.UA);
    });

    it('должен создавать UA без регистрации', () => {
      const parameters = {
        displayName: 'Any Name',
        sipServerIp: 'sip.example.com',
        sipServerUrl: 'wss://sip.example.com:8089/ws',
        register: false,
      };

      const config = uaFactory.createConfiguration(parameters);
      const ua = uaFactory.createUA(config.configuration);

      expect(config.configuration.register).toBe(false);
      expect(config.configuration.password).toBeUndefined();
      expect(ua).toBeDefined();
    });
  });
});
