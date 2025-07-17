import type { RegisteredEvent, UA, UnRegisteredEvent, WebSocketInterface } from '@krivega/jssip';
import Events from 'events-constructor';
import UAMock from '../../__fixtures__/UA.mock';
import {
  CONNECTING,
  DISCONNECTED,
  REGISTERED,
  REGISTRATION_FAILED,
  UNREGISTERED,
} from '../../constants';
import { UA_EVENT_NAMES } from '../../eventNames';
import RegistrationManager from '../RegistrationManager';

describe('RegistrationManager', () => {
  let registrationManager: RegistrationManager;
  let mockUa: UAMock;
  let uaEvents: Events<typeof UA_EVENT_NAMES>;
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

    // Создаем события UA
    uaEvents = new Events(UA_EVENT_NAMES);

    // Создаем экземпляр RegistrationManager
    registrationManager = new RegistrationManager({
      uaEvents,
      getUa: getUaMock,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Конструктор', () => {
    it('должен создавать экземпляр с зависимостями', () => {
      expect(registrationManager).toBeInstanceOf(RegistrationManager);
    });
  });

  describe('register', () => {
    it('должен успешно регистрировать UA', async () => {
      const mockRegisteredEvent: RegisteredEvent = {
        response: {
          status_code: 200,
          reason_phrase: 'OK',
        },
      } as unknown as RegisteredEvent;

      // Эмулируем успешную регистрацию
      setTimeout(() => {
        mockUa.trigger(REGISTERED, mockRegisteredEvent);
      }, 10);

      const result = await registrationManager.register();

      expect(result).toEqual(mockRegisteredEvent);
    });

    it('должен отклонять регистрацию при ошибке', async () => {
      const mockError = new Error('Registration failed');

      // Эмулируем ошибку регистрации
      setTimeout(() => {
        mockUa.trigger(REGISTRATION_FAILED, mockError as unknown as UnRegisteredEvent);
      }, 10);

      await expect(registrationManager.register()).rejects.toThrow('Registration failed');
    });

    it('должен выбрасывать ошибку когда UA не инициализирован', async () => {
      getUaMock.mockReturnValue(undefined);

      await expect(registrationManager.register()).rejects.toThrow('UA is not initialized');
    });
  });

  describe('unregister', () => {
    it('должен успешно отменять регистрацию UA', async () => {
      const mockUnregisteredEvent: UnRegisteredEvent = {
        response: {
          status_code: 200,
          reason_phrase: 'OK',
        },
      } as unknown as UnRegisteredEvent;

      // Эмулируем успешную отмену регистрации
      setTimeout(() => {
        mockUa.trigger(UNREGISTERED, mockUnregisteredEvent);
      }, 10);

      const result = await registrationManager.unregister();

      expect(result).toEqual(mockUnregisteredEvent);
    });

    it('должен выбрасывать ошибку когда UA не инициализирован', async () => {
      getUaMock.mockReturnValue(undefined);

      await expect(registrationManager.unregister()).rejects.toThrow('UA is not initialized');
    });
  });

  describe('tryRegister', () => {
    it('должен успешно перерегистрировать UA', async () => {
      const mockRegisteredEvent: RegisteredEvent = {
        response: {
          status_code: 200,
          reason_phrase: 'OK',
        },
      } as unknown as RegisteredEvent;

      // Эмулируем успешную перерегистрацию
      setTimeout(() => {
        mockUa.trigger(UNREGISTERED, {
          response: { status_code: 200, reason_phrase: 'OK' },
        } as unknown as UnRegisteredEvent);
        setTimeout(() => {
          mockUa.trigger(REGISTERED, mockRegisteredEvent);
        }, 5);
      }, 10);

      const result = await registrationManager.tryRegister();

      expect(result).toEqual(mockRegisteredEvent);
    });

    it('должен выбрасывать ошибку когда UA не инициализирован', async () => {
      getUaMock.mockReturnValue(undefined);

      await expect(registrationManager.tryRegister()).rejects.toThrow('UA is not initialized');
    });

    it('должен эмитировать событие CONNECTING перед попыткой регистрации', async () => {
      const mockRegisteredEvent: RegisteredEvent = {
        response: {
          status_code: 200,
          reason_phrase: 'OK',
        },
      } as unknown as RegisteredEvent;

      const onConnectingSpy = jest.fn();

      uaEvents.on(CONNECTING, onConnectingSpy);

      // Эмулируем успешную перерегистрацию
      setTimeout(() => {
        mockUa.trigger(UNREGISTERED, {
          response: { status_code: 200, reason_phrase: 'OK' },
        } as unknown as UnRegisteredEvent);
        setTimeout(() => {
          mockUa.trigger(REGISTERED, mockRegisteredEvent);
        }, 5);
      }, 10);

      await registrationManager.tryRegister();

      expect(onConnectingSpy).toHaveBeenCalledWith(undefined);
    });
  });

  describe('subscribeToStartEvents', () => {
    it('должен подписываться на события успеха и ошибок', () => {
      const onSuccessSpy = jest.fn();
      const onErrorSpy = jest.fn();

      const unsubscribe = registrationManager.subscribeToStartEvents(onSuccessSpy, onErrorSpy);

      expect(unsubscribe).toBeInstanceOf(Function);
    });

    it('должен вызывать onSuccess при событии REGISTERED', () => {
      const onSuccessSpy = jest.fn();
      const onErrorSpy = jest.fn();

      registrationManager.subscribeToStartEvents(onSuccessSpy, onErrorSpy);

      uaEvents.trigger(REGISTERED, {
        response: { status_code: 200, reason_phrase: 'OK' },
      } as unknown as RegisteredEvent);

      expect(onSuccessSpy).toHaveBeenCalled();
      expect(onErrorSpy).not.toHaveBeenCalled();
    });

    it('должен вызывать onError при событии REGISTRATION_FAILED', () => {
      const onSuccessSpy = jest.fn();
      const onErrorSpy = jest.fn();

      registrationManager.subscribeToStartEvents(onSuccessSpy, onErrorSpy);

      const error = new Error('Registration failed');

      uaEvents.trigger(REGISTRATION_FAILED, error);

      expect(onErrorSpy).toHaveBeenCalledWith(error);
      expect(onSuccessSpy).not.toHaveBeenCalled();
    });

    it('должен вызывать onError при событии DISCONNECTED', () => {
      const onSuccessSpy = jest.fn();
      const onErrorSpy = jest.fn();

      registrationManager.subscribeToStartEvents(onSuccessSpy, onErrorSpy);

      const error = new Error('Disconnected');

      uaEvents.trigger(DISCONNECTED, error);

      expect(onErrorSpy).toHaveBeenCalledWith(error);
      expect(onSuccessSpy).not.toHaveBeenCalled();
    });

    it('должен отписываться от событий при вызове unsubscribe', () => {
      const onSuccessSpy = jest.fn();
      const onErrorSpy = jest.fn();

      const unsubscribe = registrationManager.subscribeToStartEvents(onSuccessSpy, onErrorSpy);

      // Отписываемся
      unsubscribe();

      // Эмулируем события
      uaEvents.trigger(REGISTERED, {
        response: { status_code: 200, reason_phrase: 'OK' },
      } as unknown as RegisteredEvent);
      uaEvents.trigger(REGISTRATION_FAILED, new Error('Registration failed'));

      expect(onSuccessSpy).not.toHaveBeenCalled();
      expect(onErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Граничные случаи', () => {
    it('должен корректно обрабатывать отписку от событий при множественных подписках', () => {
      const onSuccessSpy1 = jest.fn();
      const onErrorSpy1 = jest.fn();
      const onSuccessSpy2 = jest.fn();
      const onErrorSpy2 = jest.fn();

      const unsubscribe1 = registrationManager.subscribeToStartEvents(onSuccessSpy1, onErrorSpy1);

      registrationManager.subscribeToStartEvents(onSuccessSpy2, onErrorSpy2);

      // Отписываемся от первой подписки
      unsubscribe1();

      // Эмулируем событие
      uaEvents.trigger(REGISTERED, {
        response: { status_code: 200, reason_phrase: 'OK' },
      } as unknown as RegisteredEvent);

      expect(onSuccessSpy1).not.toHaveBeenCalled();
      expect(onSuccessSpy2).toHaveBeenCalled();
    });
  });
});
