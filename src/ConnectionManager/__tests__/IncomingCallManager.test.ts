import type { RTCSession } from '@krivega/jssip';
import { NameAddrHeader, URI } from '@krivega/jssip';
import Events from 'events-constructor';
import RTCSessionMock from '../../__fixtures__/RTCSessionMock';
import {
  DECLINED_INCOMING_CALL,
  FAILED,
  FAILED_INCOMING_CALL,
  INCOMING_CALL,
  NEW_RTC_SESSION,
  Originator,
  TERMINATED_INCOMING_CALL,
} from '../../constants';
import { UA_EVENT_NAMES } from '../../eventNames';
import IncomingCallManager from '../IncomingCallManager';

// Мокаем RTCSession используя RTCSessionMock
const createMockRTCSession = (overrides: Partial<RTCSession> = {}): RTCSession => {
  const defaultRemoteIdentity = new NameAddrHeader(
    new URI('sip', 'testuser', 'test.com', 5060),
    'Test Caller',
  );

  const mockSession = new RTCSessionMock({
    url: 'sip:testuser@test.com',
    eventHandlers: {},
    originator: 'remote',
    remoteIdentity: defaultRemoteIdentity,
  });

  // Создаем моки для методов, которые мы тестируем
  mockSession.terminate = jest.fn();
  mockSession.on = jest.fn();
  mockSession.off = jest.fn();

  // Применяем переопределения
  Object.assign(mockSession, overrides);

  return mockSession as unknown as RTCSession;
};

describe('IncomingCallManager', () => {
  let uaEvents: Events<typeof UA_EVENT_NAMES>;
  let incomingCallManager: IncomingCallManager;
  let mockRTCSession: RTCSession;

  beforeEach(() => {
    uaEvents = new Events<typeof UA_EVENT_NAMES>(UA_EVENT_NAMES);
    incomingCallManager = new IncomingCallManager(uaEvents);
    mockRTCSession = createMockRTCSession();
  });

  afterEach(() => {
    incomingCallManager.stop();
  });

  describe('Конструктор', () => {
    it('должен создавать экземпляр с зависимостями', () => {
      expect(incomingCallManager).toBeInstanceOf(IncomingCallManager);
    });
  });

  describe('remoteCallerData', () => {
    it('должен возвращать пустые данные когда нет входящего звонка', () => {
      const data = incomingCallManager.remoteCallerData;

      expect(data).toEqual({
        displayName: undefined,
        host: undefined,
        incomingNumber: undefined,
        rtcSession: undefined,
      });
    });

    it('должен возвращать данные звонящего когда есть входящий звонок', () => {
      // Устанавливаем входящую сессию
      const session = new RTCSessionMock({
        url: 'sip:johndoe@example.com',
        eventHandlers: {},
        originator: 'remote',
        remoteIdentity: new NameAddrHeader(
          new URI('sip', 'johndoe', 'example.com', 5060),
          'John Doe',
        ),
      });

      // Запускаем менеджер и эмулируем входящий звонок
      incomingCallManager.start();
      uaEvents.trigger(NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session,
      });

      const data = incomingCallManager.remoteCallerData;

      expect(data).toEqual({
        displayName: 'John Doe',
        host: 'example.com',
        incomingNumber: 'johndoe',
        rtcSession: session,
      });
    });
  });

  describe('isAvailableIncomingCall', () => {
    it('должен возвращать false когда нет входящего звонка', () => {
      expect(incomingCallManager.isAvailableIncomingCall).toBe(false);
    });

    it('должен возвращать true когда есть входящий звонок', () => {
      // Запускаем менеджер и эмулируем входящий звонок
      incomingCallManager.start();
      uaEvents.trigger(NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: mockRTCSession,
      });

      expect(incomingCallManager.isAvailableIncomingCall).toBe(true);
    });
  });

  describe('start', () => {
    it('должен подписываться на события UA', () => {
      const spyOn = jest.spyOn(uaEvents, 'on');

      incomingCallManager.start();

      expect(spyOn).toHaveBeenCalledWith(NEW_RTC_SESSION, expect.any(Function));
    });
  });

  describe('stop', () => {
    it('должен отписываться от событий UA и очищать сессию', () => {
      const spyOff = jest.spyOn(uaEvents, 'off');

      // Запускаем менеджер и устанавливаем входящий звонок
      incomingCallManager.start();
      uaEvents.trigger(NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: mockRTCSession,
      });

      expect(incomingCallManager.isAvailableIncomingCall).toBe(true);

      incomingCallManager.stop();

      expect(spyOff).toHaveBeenCalledWith(NEW_RTC_SESSION, expect.any(Function));
      expect(incomingCallManager.isAvailableIncomingCall).toBe(false);
    });
  });

  describe('getIncomingRTCSession', () => {
    it('должен возвращать RTC сессию когда она существует', () => {
      // Запускаем менеджер и устанавливаем входящий звонок
      incomingCallManager.start();
      uaEvents.trigger(NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: mockRTCSession,
      });

      const session = incomingCallManager.getIncomingRTCSession();

      expect(session).toBe(mockRTCSession);
    });

    it('должен выбрасывать ошибку когда нет входящей сессии', () => {
      expect(() => {
        incomingCallManager.getIncomingRTCSession();
      }).toThrow('No incomingRTCSession');
    });
  });

  describe('declineToIncomingCall', () => {
    it('должен отклонять входящий звонок с кодом по умолчанию', async () => {
      const triggerSpy = jest.spyOn(uaEvents, 'trigger');

      // Запускаем менеджер и устанавливаем входящий звонок
      incomingCallManager.start();
      uaEvents.trigger(NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: mockRTCSession,
      });

      await incomingCallManager.declineToIncomingCall();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRTCSession.terminate).toHaveBeenCalledWith({ status_code: 487 });
      expect(triggerSpy).toHaveBeenCalledWith(DECLINED_INCOMING_CALL, {
        displayName: 'Test Caller',
        host: 'test.com',
        incomingNumber: 'testuser',
        rtcSession: mockRTCSession,
      });
      expect(incomingCallManager.isAvailableIncomingCall).toBe(false);
    });

    it('должен отклонять входящий звонок с кастомным кодом статуса', async () => {
      const customStatusCode = 486;

      // Запускаем менеджер и устанавливаем входящий звонок
      incomingCallManager.start();
      uaEvents.trigger(NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: mockRTCSession,
      });

      await incomingCallManager.declineToIncomingCall({ statusCode: customStatusCode });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRTCSession.terminate).toHaveBeenCalledWith({ status_code: customStatusCode });
    });

    it('должен выбрасывать ошибку когда нет входящей сессии', async () => {
      await expect(incomingCallManager.declineToIncomingCall()).rejects.toThrow(
        'No incomingRTCSession',
      );
    });
  });

  describe('busyIncomingCall', () => {
    it('должен отклонять входящий звонок с кодом BUSY_HERE', async () => {
      // Запускаем менеджер и устанавливаем входящий звонок
      incomingCallManager.start();
      uaEvents.trigger(NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: mockRTCSession,
      });

      await incomingCallManager.busyIncomingCall();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRTCSession.terminate).toHaveBeenCalledWith({ status_code: 486 });
    });
  });

  describe('Обработка событий NEW_RTC_SESSION', () => {
    it('должен устанавливать входящую сессию для REMOTE originator', () => {
      const triggerSpy = jest.spyOn(uaEvents, 'trigger');

      incomingCallManager.start();

      uaEvents.trigger(NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: mockRTCSession,
      });

      expect(incomingCallManager.isAvailableIncomingCall).toBe(true);
      expect(triggerSpy).toHaveBeenCalledWith(INCOMING_CALL, {
        displayName: 'Test Caller',
        host: 'test.com',
        incomingNumber: 'testuser',
        rtcSession: mockRTCSession,
      });
    });

    it('должен игнорировать события для LOCAL originator', () => {
      const triggerSpy = jest.spyOn(uaEvents, 'trigger');

      incomingCallManager.start();

      uaEvents.trigger(NEW_RTC_SESSION, {
        originator: Originator.LOCAL,
        session: mockRTCSession,
      });

      expect(incomingCallManager.isAvailableIncomingCall).toBe(false);
      expect(triggerSpy).not.toHaveBeenCalledWith(INCOMING_CALL, expect.anything());
    });
  });

  describe('Обработка событий FAILED', () => {
    it('должен обрабатывать FAILED событие от LOCAL originator', () => {
      const triggerSpy = jest.spyOn(uaEvents, 'trigger');

      // Запускаем менеджер и устанавливаем входящий звонок
      incomingCallManager.start();
      uaEvents.trigger(NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: mockRTCSession,
      });

      // Эмулируем FAILED событие от LOCAL
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const mockOn = mockRTCSession.on as jest.MockedFunction<typeof mockRTCSession.on>;
      const failedHandler = mockOn.mock.calls.find(([event]) => {
        return event === FAILED;
      })?.[1];

      if (failedHandler) {
        failedHandler({ originator: Originator.LOCAL });
      }

      expect(triggerSpy).toHaveBeenCalledWith(TERMINATED_INCOMING_CALL, {
        displayName: 'Test Caller',
        host: 'test.com',
        incomingNumber: 'testuser',
        rtcSession: mockRTCSession,
      });
      expect(incomingCallManager.isAvailableIncomingCall).toBe(false);
    });

    it('должен обрабатывать FAILED событие от REMOTE originator', () => {
      const triggerSpy = jest.spyOn(uaEvents, 'trigger');

      // Запускаем менеджер и устанавливаем входящий звонок
      incomingCallManager.start();
      uaEvents.trigger(NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: mockRTCSession,
      });

      // Эмулируем FAILED событие от REMOTE
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const mockOn = mockRTCSession.on as jest.MockedFunction<typeof mockRTCSession.on>;
      const failedHandler = mockOn.mock.calls.find(([event]) => {
        return event === FAILED;
      })?.[1];

      if (failedHandler) {
        failedHandler({ originator: Originator.REMOTE });
      }

      expect(triggerSpy).toHaveBeenCalledWith(FAILED_INCOMING_CALL, {
        displayName: 'Test Caller',
        host: 'test.com',
        incomingNumber: 'testuser',
        rtcSession: mockRTCSession,
      });
      expect(incomingCallManager.isAvailableIncomingCall).toBe(false);
    });
  });

  describe('Интеграционные сценарии', () => {
    it('должен корректно обрабатывать полный жизненный цикл входящего звонка', async () => {
      const triggerSpy = jest.spyOn(uaEvents, 'trigger');

      incomingCallManager.start();

      // Входящий звонок
      uaEvents.trigger(NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: mockRTCSession,
      });

      expect(incomingCallManager.isAvailableIncomingCall).toBe(true);
      expect(triggerSpy).toHaveBeenCalledWith(INCOMING_CALL, expect.any(Object));

      // Отклоняем звонок
      const promise = incomingCallManager.declineToIncomingCall();

      expect(incomingCallManager.isAvailableIncomingCall).toBe(false);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRTCSession.terminate).toHaveBeenCalled();
      expect(triggerSpy).toHaveBeenCalledWith(DECLINED_INCOMING_CALL, expect.any(Object));

      return promise;
    });

    it('должен корректно обрабатывать множественные входящие звонки', () => {
      const session1 = new RTCSessionMock({
        url: 'sip:caller1@test1.com',
        eventHandlers: {},
        originator: Originator.REMOTE,
        remoteIdentity: new NameAddrHeader(
          new URI('sip', 'caller1', 'test1.com', 5060),
          'Test Caller 1',
        ),
      });

      const session2 = new RTCSessionMock({
        url: 'sip:caller2@test2.com',
        eventHandlers: {},
        originator: Originator.REMOTE,
        remoteIdentity: new NameAddrHeader(
          new URI('sip', 'caller2', 'test2.com', 5060),
          'Test Caller 2',
        ),
      });

      incomingCallManager.start();

      // Первый звонок
      uaEvents.trigger(NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: session1,
      });

      expect(incomingCallManager.remoteCallerData.incomingNumber).toBe('caller1');

      // Второй звонок (заменяет первый)
      uaEvents.trigger(NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: session2,
      });

      expect(incomingCallManager.remoteCallerData.incomingNumber).toBe('caller2');
    });
  });

  describe('Граничные случаи', () => {
    it('должен корректно обрабатывать сессию без display_name', () => {
      const sessionWithoutDisplayName = new RTCSessionMock({
        url: 'sip:testuser@test.com',
        eventHandlers: {},
        originator: 'remote',
        remoteIdentity: new NameAddrHeader(new URI('sip', 'testuser', 'test.com', 5060), undefined),
      });

      incomingCallManager.start();

      uaEvents.trigger(NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: sessionWithoutDisplayName,
      });

      expect(incomingCallManager.remoteCallerData.displayName).toBeUndefined();
      expect(incomingCallManager.remoteCallerData.incomingNumber).toBe('testuser');
    });

    it('должен корректно обрабатывать сессию без uri.user', () => {
      const sessionWithoutUser = new RTCSessionMock({
        url: 'sip:@test.com',
        eventHandlers: {},
        originator: 'remote',
        remoteIdentity: new NameAddrHeader(new URI('sip', '', 'test.com', 5060), 'Test Caller'),
      });

      incomingCallManager.start();

      uaEvents.trigger(NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: sessionWithoutUser,
      });

      expect(incomingCallManager.remoteCallerData.incomingNumber).toBe('');
      expect(incomingCallManager.remoteCallerData.displayName).toBe('Test Caller');
    });

    it('должен корректно обрабатывать ошибки в declineToIncomingCall', async () => {
      const sessionWithError = new RTCSessionMock({
        url: 'sip:testuser@test.com',
        eventHandlers: {},
        originator: 'remote',
        remoteIdentity: new NameAddrHeader(
          new URI('sip', 'testuser', 'test.com', 5060),
          'Test Caller',
        ),
      });

      // Переопределяем метод terminate для эмуляции ошибки
      sessionWithError.terminate = jest.fn(() => {
        throw new Error('Termination failed');
      });

      // Запускаем менеджер и устанавливаем входящий звонок
      incomingCallManager.start();
      uaEvents.trigger(NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: sessionWithError,
      });

      await expect(incomingCallManager.declineToIncomingCall()).rejects.toThrow(
        'Termination failed',
      );
    });
  });
});
