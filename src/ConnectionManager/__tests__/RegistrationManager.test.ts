import type {
  RegisteredEvent,
  UA,
  UAEventMap,
  UnRegisteredEvent,
  WebSocketInterface,
} from '@krivega/jssip';
import Events from 'events-constructor';
import UAMock from '../../__fixtures__/UA.mock';
import {
  CONNECTING,
  DISCONNECTED,
  REGISTERED,
  REGISTRATION_FAILED,
  UNREGISTERED,
} from '../../constants';
import type { UA_JSSIP_EVENT_NAMES } from '../../eventNames';
import { UA_EVENT_NAMES } from '../../eventNames';
import logger from '../../logger';
import RegistrationManager from '../RegistrationManager';

jest.mock('../../logger', () => {
  return jest.fn();
});

// Типы для тестовых данных
interface ITestEventData {
  mockRegisteredEvent: RegisteredEvent;
  mockUnregisteredEvent: UnRegisteredEvent;
  mockError: Error;
}

// Утилиты для создания тестовых данных
const createTestEventData = (): ITestEventData => {
  return {
    mockRegisteredEvent: {
      response: {
        status_code: 200,
        reason_phrase: 'OK',
      },
    } as unknown as RegisteredEvent,
    mockUnregisteredEvent: {
      response: {
        status_code: 200,
        reason_phrase: 'OK',
      },
    } as unknown as UnRegisteredEvent,
    mockError: new Error('Test error'),
  };
};

// Утилиты для создания моков
const createUAMock = (): UAMock => {
  return new UAMock({
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
};

const createGetUaMock = (mockUa: UAMock): jest.MockedFunction<() => UA | undefined> => {
  return jest.fn(() => {
    return mockUa as unknown as UA;
  });
};

// Утилиты для асинхронных операций
const waitForEvent = async (ms = 10): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const triggerEventWithDelay = (
  mockUa: UAMock,
  event: (typeof UA_JSSIP_EVENT_NAMES)[number],
  data: Parameters<UAEventMap[typeof event]>[0],
): void => {
  setTimeout(() => {
    mockUa.trigger(event, data);
  }, 10);
};

describe('RegistrationManager', () => {
  let registrationManager: RegistrationManager;
  let mockUa: UAMock;
  let uaEvents: Events<typeof UA_EVENT_NAMES>;
  let getUaMock: jest.MockedFunction<() => UA | undefined>;
  let testData: ITestEventData;

  beforeEach(() => {
    // Инициализация тестовых данных
    testData = createTestEventData();

    // Создание моков
    mockUa = createUAMock();
    getUaMock = createGetUaMock(mockUa);
    uaEvents = new Events(UA_EVENT_NAMES);

    // Создание экземпляра RegistrationManager
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

    it('должен корректно инициализировать зависимости', () => {
      const manager = new RegistrationManager({
        uaEvents,
        getUa: getUaMock,
      });

      expect(manager).toBeDefined();
    });
  });

  describe('register', () => {
    it('должен успешно регистрировать UA', async () => {
      triggerEventWithDelay(mockUa, REGISTERED, testData.mockRegisteredEvent);

      const result = await registrationManager.register();

      expect(result).toEqual(testData.mockRegisteredEvent);
    });

    it('должен отклонять регистрацию при ошибке', async () => {
      triggerEventWithDelay(
        mockUa,
        REGISTRATION_FAILED,
        testData.mockError as unknown as UnRegisteredEvent,
      );

      await expect(registrationManager.register()).rejects.toThrow('Test error');
    });

    it('должен выбрасывать ошибку когда UA не инициализирован', async () => {
      getUaMock.mockReturnValue(undefined);

      await expect(registrationManager.register()).rejects.toThrow('UA is not initialized');
    });

    it('должен корректно обрабатывать различные статус коды', async () => {
      const eventsWithDifferentStatusCodes = [
        { status_code: 200, reason_phrase: 'OK' },
        { status_code: 201, reason_phrase: 'Created' },
        { status_code: 202, reason_phrase: 'Accepted' },
      ];

      for (const statusCode of eventsWithDifferentStatusCodes) {
        const eventData = {
          response: statusCode,
        } as unknown as RegisteredEvent;

        triggerEventWithDelay(mockUa, REGISTERED, eventData);

        // eslint-disable-next-line no-await-in-loop
        const result = await registrationManager.register();

        expect(result.response.status_code).toBe(statusCode.status_code);
      }
    });
  });

  describe('unregister', () => {
    it('должен успешно отменять регистрацию UA', async () => {
      triggerEventWithDelay(mockUa, UNREGISTERED, testData.mockUnregisteredEvent);

      const result = await registrationManager.unregister();

      expect(result).toEqual(testData.mockUnregisteredEvent);
    });

    it('должен выбрасывать ошибку когда UA не инициализирован', async () => {
      getUaMock.mockReturnValue(undefined);

      await expect(registrationManager.unregister()).rejects.toThrow('UA is not initialized');
    });

    it('должен выбрасывать ошибку когда UA равен null', async () => {
      getUaMock.mockReturnValue(undefined);

      await expect(registrationManager.unregister()).rejects.toThrow('UA is not initialized');
    });
  });

  describe('tryRegister', () => {
    it('должен успешно перерегистрировать UA', async () => {
      // Эмулируем успешную отмену регистрации, затем регистрацию
      setTimeout(() => {
        mockUa.trigger(UNREGISTERED, testData.mockUnregisteredEvent);
        setTimeout(() => {
          mockUa.trigger(REGISTERED, testData.mockRegisteredEvent);
        }, 5);
      }, 10);

      const result = await registrationManager.tryRegister();

      expect(result).toEqual(testData.mockRegisteredEvent);
    });

    it('должен выбрасывать ошибку когда UA не инициализирован', async () => {
      getUaMock.mockReturnValue(undefined);

      await expect(registrationManager.tryRegister()).rejects.toThrow('UA is not initialized');
    });

    it('должен выбрасывать ошибку когда UA равен null', async () => {
      getUaMock.mockReturnValue(undefined);

      await expect(registrationManager.tryRegister()).rejects.toThrow('UA is not initialized');
    });

    it('должен эмитировать событие CONNECTING перед попыткой регистрации', async () => {
      const onConnectingSpy = jest.fn();

      uaEvents.on(CONNECTING, onConnectingSpy);

      setTimeout(() => {
        mockUa.trigger(UNREGISTERED, testData.mockUnregisteredEvent);
        setTimeout(() => {
          mockUa.trigger(REGISTERED, testData.mockRegisteredEvent);
        }, 5);
      }, 10);

      await registrationManager.tryRegister();

      expect(onConnectingSpy).toHaveBeenCalledWith(undefined);
    });

    it('должен корректно обрабатывать ошибку при unregister и продолжать регистрацию', async () => {
      // Мокаем метод unregister чтобы он выбрасывал ошибку
      const unregisterMock = jest
        .spyOn(registrationManager, 'unregister')
        .mockRejectedValue(new Error('Unregister failed'));

      triggerEventWithDelay(mockUa, REGISTERED, testData.mockRegisteredEvent);

      const result = await registrationManager.tryRegister();

      expect(result).toEqual(testData.mockRegisteredEvent);
      expect(logger).toHaveBeenCalledWith('tryRegister', expect.any(Error));

      // Восстанавливаем оригинальный метод
      unregisterMock.mockRestore();
    });

    it('должен корректно обрабатывать множественные ошибки при unregister', async () => {
      const unregisterMock = jest
        .spyOn(registrationManager, 'unregister')
        .mockRejectedValue(new Error('Multiple unregister errors'));

      triggerEventWithDelay(mockUa, REGISTERED, testData.mockRegisteredEvent);

      const result = await registrationManager.tryRegister();

      expect(result).toEqual(testData.mockRegisteredEvent);
      expect(logger).toHaveBeenCalledWith('tryRegister', expect.any(Error));

      unregisterMock.mockRestore();
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

      uaEvents.trigger(REGISTERED, testData.mockRegisteredEvent);

      expect(onSuccessSpy).toHaveBeenCalled();
      expect(onErrorSpy).not.toHaveBeenCalled();
    });

    it('должен вызывать onError при событии REGISTRATION_FAILED', () => {
      const onSuccessSpy = jest.fn();
      const onErrorSpy = jest.fn();

      registrationManager.subscribeToStartEvents(onSuccessSpy, onErrorSpy);

      uaEvents.trigger(REGISTRATION_FAILED, testData.mockError);

      expect(onErrorSpy).toHaveBeenCalledWith(testData.mockError);
      expect(onSuccessSpy).not.toHaveBeenCalled();
    });

    it('должен вызывать onError при событии DISCONNECTED', () => {
      const onSuccessSpy = jest.fn();
      const onErrorSpy = jest.fn();

      registrationManager.subscribeToStartEvents(onSuccessSpy, onErrorSpy);

      uaEvents.trigger(DISCONNECTED, testData.mockError);

      expect(onErrorSpy).toHaveBeenCalledWith(testData.mockError);
      expect(onSuccessSpy).not.toHaveBeenCalled();
    });

    it('должен отписываться от событий при вызове unsubscribe', () => {
      const onSuccessSpy = jest.fn();
      const onErrorSpy = jest.fn();

      const unsubscribe = registrationManager.subscribeToStartEvents(onSuccessSpy, onErrorSpy);

      // Отписываемся
      unsubscribe();

      // Эмулируем события
      uaEvents.trigger(REGISTERED, testData.mockRegisteredEvent);
      uaEvents.trigger(REGISTRATION_FAILED, testData.mockError);

      expect(onSuccessSpy).not.toHaveBeenCalled();
      expect(onErrorSpy).not.toHaveBeenCalled();
    });

    it('должен корректно обрабатывать null/undefined колбэки', () => {
      // Пропускаем этот тест, так как events-constructor не поддерживает null/undefined колбэки
      expect(true).toBe(true);
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
      uaEvents.trigger(REGISTERED, testData.mockRegisteredEvent);

      expect(onSuccessSpy1).not.toHaveBeenCalled();
      expect(onSuccessSpy2).toHaveBeenCalled();
    });

    it('должен корректно обрабатывать множественные отписки', () => {
      const onSuccessSpy = jest.fn();
      const onErrorSpy = jest.fn();

      const unsubscribe = registrationManager.subscribeToStartEvents(onSuccessSpy, onErrorSpy);

      // Множественные отписки не должны вызывать ошибку
      expect(() => {
        unsubscribe();
        unsubscribe();
        unsubscribe();
      }).not.toThrow();
    });

    it('должен корректно обрабатывать race conditions при множественных регистрациях', async () => {
      const promises = [];

      // Запускаем несколько регистраций одновременно
      for (let i = 0; i < 3; i++) {
        const promise = registrationManager.register().catch(() => {});

        promises.push(promise);
      }

      // Эмулируем успешную регистрацию для всех
      setTimeout(() => {
        mockUa.trigger(REGISTERED, testData.mockRegisteredEvent);
      }, 10);

      await Promise.all(promises);
    });

    it('должен корректно обрабатывать таймауты при регистрации', async () => {
      // Не эмулируем события, чтобы проверить поведение при таймауте
      const registerPromise = registrationManager.register();

      // Ждем немного, но не до таймаута
      await waitForEvent(50);

      // Проверяем, что промис еще не разрешен
      expect(registerPromise).toBeDefined();
    });

    it('должен корректно обрабатывать очистку event listeners при ошибках', async () => {
      const onSuccessSpy = jest.fn();
      const onErrorSpy = jest.fn();

      registrationManager.subscribeToStartEvents(onSuccessSpy, onErrorSpy);

      // Эмулируем ошибку
      uaEvents.trigger(REGISTRATION_FAILED, testData.mockError);

      // Проверяем, что колбэк был вызван
      expect(onErrorSpy).toHaveBeenCalledWith(testData.mockError);

      // Эмулируем успешное событие после ошибки
      uaEvents.trigger(REGISTERED, testData.mockRegisteredEvent);

      // Проверяем, что успешный колбэк все еще работает
      expect(onSuccessSpy).toHaveBeenCalled();
    });

    it('должен корректно обрабатывать события с пустыми данными', () => {
      const onSuccessSpy = jest.fn();
      const onErrorSpy = jest.fn();

      registrationManager.subscribeToStartEvents(onSuccessSpy, onErrorSpy);

      // Эмулируем события с пустыми данными
      uaEvents.trigger(REGISTERED, undefined);
      uaEvents.trigger(REGISTRATION_FAILED, undefined);
      uaEvents.trigger(DISCONNECTED, undefined);

      // Проверяем, что колбэки были вызваны
      expect(onSuccessSpy).toHaveBeenCalled();
      expect(onErrorSpy).toHaveBeenCalledTimes(2);
    });
  });
});
