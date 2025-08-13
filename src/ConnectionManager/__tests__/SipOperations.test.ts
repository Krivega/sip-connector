import jssip from '@/__fixtures__/jssip.mock';
import UAMock from '@/__fixtures__/UA.mock';
import SipOperations from '../SipOperations';
import UAFactory from '../UAFactory';

import type { Socket, UA, URI } from '@krivega/jssip';
import type { TJsSIP } from '@/types';

describe('SipOperations', () => {
  let uaFactory: UAFactory;
  let sipOperations: SipOperations;
  let mockUA: UAMock;
  let getUaProtected: () => UA;

  beforeEach(() => {
    uaFactory = new UAFactory(jssip as unknown as TJsSIP);
    mockUA = new UAMock({
      uri: 'sip:testuser@sip.example.com',
      register: false,
      sockets: [{}] as unknown as Socket,
    });
    getUaProtected = jest.fn(() => {
      return mockUA as unknown as UA;
    });

    sipOperations = new SipOperations({
      uaFactory,
      getUaProtected,
    });
  });

  describe('конструктор', () => {
    it('должен создавать экземпляр с переданными зависимостями', () => {
      expect(sipOperations).toBeInstanceOf(SipOperations);
    });
  });

  describe('sendOptions', () => {
    it('должен отправлять OPTIONS запрос с URI строкой', async () => {
      const target = 'sip:target@sip.example.com';
      const body = 'test body';
      const extraHeaders = ['X-Custom-Header: value'];

      mockUA.sendOptions.mockImplementation(
        (_targetParameter: string, _bodyParameter?: string, options?: Record<string, unknown>) => {
          (options as { eventHandlers: { succeeded: () => void } }).eventHandlers.succeeded();
        },
      );

      await expect(sipOperations.sendOptions(target, body, extraHeaders)).resolves.toBeUndefined();

      expect(mockUA.sendOptions).toHaveBeenCalledWith(target, body, {
        extraHeaders,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        eventHandlers: expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          succeeded: expect.any(Function),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          failed: expect.any(Function),
        }),
      });
    });

    it('должен отправлять OPTIONS запрос с URI объектом', async () => {
      const target = { uri: 'sip:target@sip.example.com' } as unknown as URI;
      const body = 'test body';

      mockUA.sendOptions.mockImplementation(
        (_targetParameter: string, _bodyParameter?: string, options?: Record<string, unknown>) => {
          (options as { eventHandlers: { succeeded: () => void } }).eventHandlers.succeeded();
        },
      );

      await expect(sipOperations.sendOptions(target, body)).resolves.toBeUndefined();

      expect(mockUA.sendOptions).toHaveBeenCalledWith(target, body, {
        extraHeaders: undefined,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        eventHandlers: expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          succeeded: expect.any(Function),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          failed: expect.any(Function),
        }),
      });
    });

    it('должен отправлять OPTIONS запрос без body и extraHeaders', async () => {
      const target = 'sip:target@sip.example.com';

      mockUA.sendOptions.mockImplementation(
        (_targetParameter: string, _bodyParameter?: string, options?: Record<string, unknown>) => {
          (options as { eventHandlers: { succeeded: () => void } }).eventHandlers.succeeded();
        },
      );

      await expect(sipOperations.sendOptions(target)).resolves.toBeUndefined();

      expect(mockUA.sendOptions).toHaveBeenCalledWith(target, undefined, {
        extraHeaders: undefined,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        eventHandlers: expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          succeeded: expect.any(Function),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          failed: expect.any(Function),
        }),
      });
    });
    it('должен выбрасывать ошибку при неудачном запросе', async () => {
      const target = 'sip:target@sip.example.com';
      const error = new Error('Request failed');

      mockUA.sendOptions.mockImplementation(
        (_targetParameter: string, _bodyParameter?: string, options?: Record<string, unknown>) => {
          (options as { eventHandlers: { failed: (error: Error) => void } }).eventHandlers.failed(
            error,
          );
        },
      );

      await expect(sipOperations.sendOptions(target)).rejects.toThrow('Request failed');
    });

    it('должен выбрасывать ошибку при исключении в sendOptions', async () => {
      const target = 'sip:target@sip.example.com';
      const error = new Error('Send options error');

      mockUA.sendOptions.mockImplementation(() => {
        throw error;
      });

      await expect(sipOperations.sendOptions(target)).rejects.toThrow('Send options error');
    });
  });

  describe('ping', () => {
    it('должен отправлять ping к собственному URI', async () => {
      const body = 'ping body';
      const extraHeaders = ['X-Ping-Header: value'];

      mockUA.sendOptions.mockImplementation(
        (targetParameter: string, _bodyParameter?: string, options?: Record<string, unknown>) => {
          // Проверяем, что targetParam содержит правильный URI (может быть объектом или строкой)
          expect(targetParameter).toEqual(
            expect.objectContaining({
              _scheme: 'sip',
              _user: 'testuser',
              _host: 'sip.example.com',
            }),
          );
          (options as { eventHandlers: { succeeded: () => void } }).eventHandlers.succeeded();
        },
      );

      await expect(sipOperations.ping(body, extraHeaders)).resolves.toBeUndefined();

      expect(mockUA.sendOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          _scheme: 'sip',
          _user: 'testuser',
          _host: 'sip.example.com',
        }),
        body,
        {
          extraHeaders,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          eventHandlers: expect.objectContaining({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            succeeded: expect.any(Function),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            failed: expect.any(Function),
          }),
        },
      );
    });

    it('должен отправлять ping без body и extraHeaders', async () => {
      mockUA.sendOptions.mockImplementation(
        (targetParameter: string, _bodyParameter?: string, options?: Record<string, unknown>) => {
          // Проверяем, что targetParam содержит правильный URI
          expect(targetParameter).toEqual(
            expect.objectContaining({
              _scheme: 'sip',
              _user: 'testuser',
              _host: 'sip.example.com',
            }),
          );
          (options as { eventHandlers: { succeeded: () => void } }).eventHandlers.succeeded();
        },
      );

      await expect(sipOperations.ping()).resolves.toBeUndefined();

      expect(mockUA.sendOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          _scheme: 'sip',
          _user: 'testuser',
          _host: 'sip.example.com',
        }),
        undefined,
        {
          extraHeaders: undefined,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          eventHandlers: expect.objectContaining({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            succeeded: expect.any(Function),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            failed: expect.any(Function),
          }),
        },
      );
    });
  });

  describe('checkTelephony', () => {
    const checkTelephonyParams = {
      displayName: 'Test User',
      sipServerUrl: 'sip.example.com',
      sipWebSocketServerURL: 'wss://sip.example.com:8089/ws',
      userAgent: 'Test UA',
      remoteAddress: '192.168.1.1',
      extraHeaders: ['X-Test-Header: value'],
    };

    it('должен успешно проверять доступность телефонии', async () => {
      // Мокаем создание UA
      const mockCreatedUA = new UAMock({
        uri: 'sip:testuser@sip.example.com',
        register: false,
        sockets: [{}] as unknown as Socket,
      });

      const eventHandlers: Record<string, (() => void) | undefined> = {};
      let resolveHandler: (() => void) | undefined;

      // Делаем once jest функцией
      mockCreatedUA.once.mockImplementation((event: string, handler: () => void) => {
        if (event === 'disconnected') {
          // Первый вызов - reject handler, второй - resolve handler
          if (eventHandlers.disconnected) {
            resolveHandler = handler;
          } else {
            eventHandlers.disconnected = handler;
          }
        } else if (event === 'connected') {
          eventHandlers.connected = handler;
        }

        return mockCreatedUA;
      });

      // Мокаем методы UAFactory
      const createConfigurationSpy = jest.spyOn(uaFactory, 'createConfiguration').mockReturnValue({
        configuration: {
          uri: 'sip:testuser@sip.example.com',
          password: 'testpass',
          register: false,
          display_name: 'Test_User',
          sdpSemantics: 'unified-plan',
          sockets: [{}] as unknown as Socket,
        },
        helpers: {
          socket: {} as Socket,
          getSipServerUrl: jest.fn(),
        },
      });

      const createUASpy = jest
        .spyOn(uaFactory as unknown as { createUA: jest.Mock }, 'createUA')
        .mockReturnValue(mockCreatedUA);

      const checkPromise = sipOperations.checkTelephony(checkTelephonyParams);

      // Симулируем успешное подключение
      eventHandlers.connected?.();

      // Симулируем отключение после stop() - вызываем resolve handler
      if (resolveHandler) {
        resolveHandler();
      }

      await expect(checkPromise).resolves.toBeUndefined();

      expect(createConfigurationSpy).toHaveBeenCalledWith({
        sipWebSocketServerURL: 'wss://sip.example.com:8089/ws',
        displayName: 'Test User',
        userAgent: 'Test UA',
        sipServerUrl: 'sip.example.com',
      });

      expect(createUASpy).toHaveBeenCalledWith({
        uri: 'sip:testuser@sip.example.com',
        password: 'testpass',
        register: false,
        display_name: 'Test_User',
        sdpSemantics: 'unified-plan',
        sockets: [{}],
        remoteAddress: '192.168.1.1',
        extraHeaders: ['X-Test-Header: value'],
      });

      expect(mockCreatedUA.once).toHaveBeenCalledWith('disconnected', expect.any(Function));
      expect(mockCreatedUA.once).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(mockCreatedUA.start).toHaveBeenCalled();
      expect(mockCreatedUA.removeAllListeners).toHaveBeenCalled();
      expect(mockCreatedUA.stop).toHaveBeenCalled();
    });

    it('должен выбрасывать ошибку при неудачной проверке телефонии', async () => {
      const mockCreatedUA = new UAMock({
        uri: 'sip:testuser@sip.example.com',
        register: false,
        sockets: [{}] as unknown as Socket,
      });

      const eventHandlers: Record<string, () => void> = {};

      mockCreatedUA.once.mockImplementation((event: string, handler: () => void) => {
        eventHandlers[event] = handler;

        return mockCreatedUA;
      });

      jest.spyOn(uaFactory, 'createConfiguration').mockReturnValue({
        configuration: {
          uri: 'sip:testuser@sip.example.com',
          password: 'testpass',
          register: false,
          display_name: 'Test_User',
          sdpSemantics: 'unified-plan',
          sockets: [{}] as unknown as Socket,
        },
        helpers: {
          socket: {} as Socket,
          getSipServerUrl: jest.fn(),
        },
      });

      jest
        .spyOn(uaFactory as unknown as { createUA: jest.Mock }, 'createUA')
        .mockReturnValue(mockCreatedUA);

      const checkPromise = sipOperations.checkTelephony(checkTelephonyParams);

      // Симулируем отключение до подключения
      eventHandlers.disconnected();

      await expect(checkPromise).rejects.toThrow('Telephony is not available');

      expect(mockCreatedUA.once).toHaveBeenCalledWith('disconnected', expect.any(Function));
      expect(mockCreatedUA.start).toHaveBeenCalled();
    });

    it('должен создавать конфигурацию с минимальными параметрами', async () => {
      const minimalParams = {
        displayName: 'Test User',
        sipServerUrl: 'sip.example.com',
        sipWebSocketServerURL: 'wss://sip.example.com:8089/ws',
      };

      const mockCreatedUA = new UAMock({
        uri: 'sip:testuser@sip.example.com',
        register: false,
        sockets: [{}] as unknown as Socket,
      });

      const eventHandlers: Record<string, (() => void) | undefined> = {};
      let resolveHandler: (() => void) | undefined;

      mockCreatedUA.once.mockImplementation((event: string, handler: () => void) => {
        if (event === 'disconnected') {
          // Первый вызов - reject handler, второй - resolve handler
          if (eventHandlers.disconnected) {
            resolveHandler = handler;
          } else {
            eventHandlers.disconnected = handler;
          }
        } else if (event === 'connected') {
          eventHandlers.connected = handler;
        }

        return mockCreatedUA;
      });

      const createConfigurationSpy = jest.spyOn(uaFactory, 'createConfiguration').mockReturnValue({
        configuration: {
          uri: 'sip:testuser@sip.example.com',
          password: undefined,
          register: false,
          display_name: 'Test_User',
          sdpSemantics: 'unified-plan',
          sockets: [{}] as unknown as Socket,
        },
        helpers: {
          socket: {} as Socket,
          getSipServerUrl: jest.fn(),
        },
      });

      jest
        .spyOn(uaFactory as unknown as { createUA: jest.Mock }, 'createUA')
        .mockReturnValue(mockCreatedUA);

      const checkPromise = sipOperations.checkTelephony(minimalParams);

      // Симулируем успешное подключение
      eventHandlers.connected?.();

      // Симулируем отключение после stop() - вызываем resolve handler
      if (resolveHandler) {
        resolveHandler();
      }

      await expect(checkPromise).resolves.toBeUndefined();

      expect(createConfigurationSpy).toHaveBeenCalledWith({
        sipWebSocketServerURL: 'wss://sip.example.com:8089/ws',
        displayName: 'Test User',
        userAgent: undefined,
        sipServerUrl: 'sip.example.com',
      });
    });
  });

  describe('интеграционные тесты', () => {
    it('должен корректно обрабатывать полный цикл ping', async () => {
      const body = 'ping test';
      const extraHeaders = ['X-Ping: test'];

      mockUA.sendOptions.mockImplementation(
        (targetParameter: string, bodyParameter?: string, options?: Record<string, unknown>) => {
          // Проверяем, что targetParam содержит правильный URI
          expect(targetParameter).toEqual(
            expect.objectContaining({
              _scheme: 'sip',
              _user: 'testuser',
              _host: 'sip.example.com',
            }),
          );
          expect(bodyParameter).toBe('ping test');
          expect((options as { extraHeaders: string[] }).extraHeaders).toEqual(['X-Ping: test']);
          (options as { eventHandlers: { succeeded: () => void } }).eventHandlers.succeeded();
        },
      );

      await expect(sipOperations.ping(body, extraHeaders)).resolves.toBeUndefined();

      expect(mockUA.sendOptions).toHaveBeenCalledTimes(1);
    });

    it('должен корректно обрабатывать ошибки в sendOptions', async () => {
      const target = 'sip:target@sip.example.com';

      mockUA.sendOptions.mockImplementation(
        (_targetParameter: string, _bodyParameter?: string, options?: Record<string, unknown>) => {
          const error = new Error('Network error');

          (options as { eventHandlers: { failed: (error: Error) => void } }).eventHandlers.failed(
            error,
          );
        },
      );

      await expect(sipOperations.sendOptions(target)).rejects.toThrow('Network error');
    });
  });
});
