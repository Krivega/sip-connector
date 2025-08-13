import { NameAddrHeader, URI } from '@krivega/jssip';

import jssip from '@/__fixtures__/jssip.mock';
import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import { ConnectionManager, EConnectionManagerEvent } from '@/ConnectionManager';
import IncomingCallManager from '../@IncomingCallManager';
import { Originator } from '../eventNames';

import type { RTCSession } from '@krivega/jssip';
import type { TJsSIP } from '@/types';

// FAILED event name for RTCSession
const FAILED = 'failed';

// Мокаем RTCSession используя RTCSessionMock
const createMockRTCSession = (overrides: Partial<RTCSession> = {}): RTCSession => {
  const defaultRemoteIdentity = new NameAddrHeader(
    new URI('sip', 'testuser', 'test.com', 5060),
    'Test Caller',
  );

  const mockSession = new RTCSessionMock({
    eventHandlers: {},
    originator: Originator.REMOTE,
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
  let connectionManager: ConnectionManager;
  let incomingCallManager: IncomingCallManager;
  let mockRTCSession: RTCSession;

  beforeEach(() => {
    connectionManager = new ConnectionManager({
      JsSIP: jssip as unknown as TJsSIP,
    });
    incomingCallManager = new IncomingCallManager(connectionManager);
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
        eventHandlers: {},
        originator: Originator.REMOTE,
        remoteIdentity: new NameAddrHeader(
          new URI('sip', 'johndoe', 'example.com', 5060),
          'John Doe',
        ),
      });

      // Запускаем менеджер и эмулируем входящий звонок
      incomingCallManager.start();
      connectionManager.events.trigger(EConnectionManagerEvent.NEW_RTC_SESSION, {
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
      connectionManager.events.trigger(EConnectionManagerEvent.NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: mockRTCSession,
      });

      expect(incomingCallManager.isAvailableIncomingCall).toBe(true);
    });
  });

  describe('start', () => {
    it('должен подписываться на события UA', () => {
      const spyOn = jest.spyOn(connectionManager, 'on');

      incomingCallManager.start();

      expect(spyOn).toHaveBeenCalledWith(
        EConnectionManagerEvent.NEW_RTC_SESSION,
        expect.any(Function),
      );
    });
  });

  describe('stop', () => {
    it('должен отписываться от событий UA и очищать сессию', () => {
      const spyOff = jest.spyOn(connectionManager, 'off');

      // Запускаем менеджер и устанавливаем входящий звонок
      incomingCallManager.start();
      connectionManager.events.trigger(EConnectionManagerEvent.NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: mockRTCSession,
      });

      expect(incomingCallManager.isAvailableIncomingCall).toBe(true);

      incomingCallManager.stop();

      expect(spyOff).toHaveBeenCalledWith(
        EConnectionManagerEvent.NEW_RTC_SESSION,
        expect.any(Function),
      );
      expect(incomingCallManager.isAvailableIncomingCall).toBe(false);
    });
  });

  describe('getIncomingRTCSession', () => {
    it('должен возвращать RTC сессию когда она существует', () => {
      // Запускаем менеджер и устанавливаем входящий звонок
      incomingCallManager.start();
      connectionManager.events.trigger(EConnectionManagerEvent.NEW_RTC_SESSION, {
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
      const handler = jest.fn();

      incomingCallManager.on('declinedIncomingCall', handler);

      // Запускаем менеджер и устанавливаем входящий звонок
      incomingCallManager.start();
      connectionManager.events.trigger(EConnectionManagerEvent.NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: mockRTCSession,
      });

      await incomingCallManager.declineToIncomingCall();
      expect(mockRTCSession.terminate).toHaveBeenCalledWith({ status_code: 487 });
      expect(handler).toHaveBeenCalledWith({
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
      connectionManager.events.trigger(EConnectionManagerEvent.NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: mockRTCSession,
      });

      await incomingCallManager.declineToIncomingCall({ statusCode: customStatusCode });
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
      connectionManager.events.trigger(EConnectionManagerEvent.NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: mockRTCSession,
      });

      await incomingCallManager.busyIncomingCall();
      expect(mockRTCSession.terminate).toHaveBeenCalledWith({ status_code: 486 });
    });
  });

  describe('Обработка событий NEW_RTC_SESSION', () => {
    it('должен устанавливать входящую сессию для REMOTE originator', () => {
      const handler = jest.fn();

      incomingCallManager.on('incomingCall', handler);

      incomingCallManager.start();

      connectionManager.events.trigger(EConnectionManagerEvent.NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: mockRTCSession,
      });

      expect(incomingCallManager.isAvailableIncomingCall).toBe(true);
      expect(handler).toHaveBeenCalledWith({
        displayName: 'Test Caller',
        host: 'test.com',
        incomingNumber: 'testuser',
        rtcSession: mockRTCSession,
      });
    });

    it('должен игнорировать события для LOCAL originator', () => {
      const handler = jest.fn();

      incomingCallManager.on('incomingCall', handler);

      incomingCallManager.start();

      connectionManager.events.trigger(EConnectionManagerEvent.NEW_RTC_SESSION, {
        originator: Originator.LOCAL,
        session: mockRTCSession,
      });

      expect(incomingCallManager.isAvailableIncomingCall).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Обработка событий FAILED', () => {
    it('должен обрабатывать FAILED событие от LOCAL originator', () => {
      const handler = jest.fn();

      incomingCallManager.on('terminatedIncomingCall', handler);

      // Запускаем менеджер и устанавливаем входящий звонок
      incomingCallManager.start();
      connectionManager.events.trigger(EConnectionManagerEvent.NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: mockRTCSession,
      });

      // Эмулируем FAILED событие от LOCAL

      const mockOn = mockRTCSession.on as jest.MockedFunction<typeof mockRTCSession.on>;
      const failedHandler = mockOn.mock.calls.find(([event]) => {
        return event === FAILED;
      })?.[1];

      if (failedHandler) {
        failedHandler({ originator: Originator.LOCAL });
      }

      expect(handler).toHaveBeenCalledWith({
        displayName: 'Test Caller',
        host: 'test.com',
        incomingNumber: 'testuser',
        rtcSession: mockRTCSession,
      });
      expect(incomingCallManager.isAvailableIncomingCall).toBe(false);
    });

    it('должен обрабатывать FAILED событие от REMOTE originator', () => {
      const handler = jest.fn();

      incomingCallManager.on('failedIncomingCall', handler);

      // Запускаем менеджер и устанавливаем входящий звонок
      incomingCallManager.start();
      connectionManager.events.trigger(EConnectionManagerEvent.NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: mockRTCSession,
      });

      // Эмулируем FAILED событие от REMOTE

      const mockOn = mockRTCSession.on as jest.MockedFunction<typeof mockRTCSession.on>;
      const failedHandler = mockOn.mock.calls.find(([event]) => {
        return event === FAILED;
      })?.[1];

      if (failedHandler) {
        failedHandler({ originator: Originator.REMOTE });
      }

      expect(handler).toHaveBeenCalledWith({
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
      const handlerIncoming = jest.fn();
      const handlerDeclined = jest.fn();

      incomingCallManager.on('incomingCall', handlerIncoming);
      incomingCallManager.on('declinedIncomingCall', handlerDeclined);

      incomingCallManager.start();

      // Входящий звонок
      connectionManager.events.trigger(EConnectionManagerEvent.NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: mockRTCSession,
      });

      expect(incomingCallManager.isAvailableIncomingCall).toBe(true);
      expect(handlerIncoming).toHaveBeenCalledWith(expect.any(Object));

      // Отклоняем звонок
      const promise = incomingCallManager.declineToIncomingCall();

      expect(incomingCallManager.isAvailableIncomingCall).toBe(false);

      expect(mockRTCSession.terminate).toHaveBeenCalled();
      expect(handlerDeclined).toHaveBeenCalledWith(expect.any(Object));

      return promise;
    });

    it('должен корректно обрабатывать множественные входящие звонки', () => {
      const session1 = new RTCSessionMock({
        eventHandlers: {},
        originator: Originator.REMOTE,
        remoteIdentity: new NameAddrHeader(
          new URI('sip', 'caller1', 'test1.com', 5060),
          'Test Caller 1',
        ),
      });

      const session2 = new RTCSessionMock({
        eventHandlers: {},
        originator: Originator.REMOTE,
        remoteIdentity: new NameAddrHeader(
          new URI('sip', 'caller2', 'test2.com', 5060),
          'Test Caller 2',
        ),
      });

      incomingCallManager.start();

      // Первый звонок
      connectionManager.events.trigger(EConnectionManagerEvent.NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: session1,
      });

      expect(incomingCallManager.remoteCallerData.incomingNumber).toBe('caller1');

      // Второй звонок (заменяет первый)
      connectionManager.events.trigger(EConnectionManagerEvent.NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: session2,
      });

      expect(incomingCallManager.remoteCallerData.incomingNumber).toBe('caller2');
    });
  });

  describe('Граничные случаи', () => {
    it('должен корректно обрабатывать сессию без display_name', () => {
      const sessionWithoutDisplayName = new RTCSessionMock({
        eventHandlers: {},
        originator: Originator.REMOTE,
        remoteIdentity: new NameAddrHeader(new URI('sip', 'testuser', 'test.com', 5060), undefined),
      });

      incomingCallManager.start();

      connectionManager.events.trigger(EConnectionManagerEvent.NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: sessionWithoutDisplayName,
      });

      expect(incomingCallManager.remoteCallerData.displayName).toBeUndefined();
      expect(incomingCallManager.remoteCallerData.incomingNumber).toBe('testuser');
    });

    it('должен корректно обрабатывать сессию без uri.user', () => {
      const sessionWithoutUser = new RTCSessionMock({
        eventHandlers: {},
        originator: Originator.REMOTE,
        remoteIdentity: new NameAddrHeader(new URI('sip', '', 'test.com', 5060), 'Test Caller'),
      });

      incomingCallManager.start();

      connectionManager.events.trigger(EConnectionManagerEvent.NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: sessionWithoutUser,
      });

      expect(incomingCallManager.remoteCallerData.incomingNumber).toBe('');
      expect(incomingCallManager.remoteCallerData.displayName).toBe('Test Caller');
    });

    it('должен корректно обрабатывать ошибки в declineToIncomingCall', async () => {
      const sessionWithError = new RTCSessionMock({
        eventHandlers: {},
        originator: Originator.REMOTE,
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
      connectionManager.events.trigger(EConnectionManagerEvent.NEW_RTC_SESSION, {
        originator: Originator.REMOTE,
        session: sessionWithError,
      });

      await expect(incomingCallManager.declineToIncomingCall()).rejects.toThrow(
        'Termination failed',
      );
    });
  });
});

describe('API событий IncomingCallManager', () => {
  let incomingCallManager: IncomingCallManager;
  let connectionManager: ConnectionManager;
  let mockRTCSession: RTCSession;

  beforeEach(() => {
    connectionManager = new ConnectionManager({ JsSIP: jssip as unknown as TJsSIP });
    incomingCallManager = new IncomingCallManager(connectionManager);
    mockRTCSession = createMockRTCSession();
  });

  it('on: должен вызывать handler при входящем звонке', () => {
    const handler = jest.fn();

    incomingCallManager.on('incomingCall', handler);
    incomingCallManager.start();
    connectionManager.events.trigger(EConnectionManagerEvent.NEW_RTC_SESSION, {
      originator: Originator.REMOTE,
      session: mockRTCSession,
    });
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ rtcSession: mockRTCSession }));
    incomingCallManager.off('incomingCall', handler);
  });

  it('once: должен вызывать handler только один раз', () => {
    const handler = jest.fn();

    incomingCallManager.once('incomingCall', handler);
    incomingCallManager.start();
    connectionManager.events.trigger(EConnectionManagerEvent.NEW_RTC_SESSION, {
      originator: Originator.REMOTE,
      session: mockRTCSession,
    });
    connectionManager.events.trigger(EConnectionManagerEvent.NEW_RTC_SESSION, {
      originator: Originator.REMOTE,
      session: mockRTCSession,
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('onceRace: должен вызывать handler для первого из событий', async () => {
    const handler = jest.fn();

    incomingCallManager.onceRace(['incomingCall', 'declinedIncomingCall'], handler);
    incomingCallManager.start();
    connectionManager.events.trigger(EConnectionManagerEvent.NEW_RTC_SESSION, {
      originator: Originator.REMOTE,
      session: mockRTCSession,
    });
    await incomingCallManager.declineToIncomingCall();
    expect(handler).toHaveBeenCalledTimes(1);

    // Безопасно достаём второй аргумент вызова handler
    const callArgs = handler.mock.calls as unknown[][];
    const eventName = callArgs[0]?.[1];

    expect(['incomingCall', 'declinedIncomingCall']).toContain(eventName);
  });

  it('wait: должен резолвить промис при входящем звонке', async () => {
    incomingCallManager.start();

    const promise = incomingCallManager.wait('incomingCall');

    connectionManager.events.trigger(EConnectionManagerEvent.NEW_RTC_SESSION, {
      originator: Originator.REMOTE,
      session: mockRTCSession,
    });
    await expect(promise).resolves.toEqual(expect.objectContaining({ rtcSession: mockRTCSession }));
  });
});
