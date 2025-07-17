// В этом тесте стараемся избегать `any` и глобальных отключений eslint. Для отдельных неоднозначных мест используем точечные директивы.

import type { Socket, UA } from '@krivega/jssip';
import Events from 'events-constructor';
import jssip from '../../__fixtures__/jssip.mock';
import UAMock from '../../__fixtures__/UA.mock';
import { DISCONNECTED } from '../../constants';
import { UA_EVENT_NAMES } from '../../eventNames';
import type { TJsSIP } from '../../types';
import type { TParametersConnection } from '../ConnectionFlow';
import ConnectionFlow from '../ConnectionFlow';
import ConnectionStateMachine from '../ConnectionStateMachine';
import IncomingCallManager from '../IncomingCallManager';
import type RegistrationManager from '../RegistrationManager';
import SipEventHandler from '../SipEventHandler';
import UAFactory from '../UAFactory';

// Мокаем logger, чтобы не засорять вывод
jest.mock('../../logger', () => {
  return jest.fn();
});

describe('ConnectionFlow', () => {
  let uaEvents: Events<typeof UA_EVENT_NAMES>;
  let uaFactory: UAFactory;
  let stateMachine: ConnectionStateMachine;
  let incomingCallManager: IncomingCallManager;
  let sipEventHandler: SipEventHandler;
  let registrationManager: RegistrationManager;
  let connectionFlow: ConnectionFlow;

  let uaInstance: UAMock | undefined;

  const getUa = jest.fn(() => {
    return uaInstance as unknown as UA | undefined;
  });
  const setUa = jest.fn((ua: UA | undefined) => {
    uaInstance = ua as UAMock | undefined;
  });

  type TConnectionConfig = {
    sipServerUrl?: string;
    displayName?: string;
    register?: boolean;
    user?: string;
    password?: string;
  };

  let connectionConfiguration: TConnectionConfig = {};

  const getConnectionConfiguration = jest.fn((): TConnectionConfig => {
    return connectionConfiguration;
  });

  const setConnectionConfiguration = jest.fn((config: TConnectionConfig) => {
    connectionConfiguration = config;
  });

  const setSipServerUrl = jest.fn();
  const setSocket = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers({ legacyFakeTimers: true });
    jest.clearAllMocks();

    connectionConfiguration = {};
    uaEvents = new Events<typeof UA_EVENT_NAMES>(UA_EVENT_NAMES);
    uaFactory = new UAFactory(jssip as unknown as TJsSIP);
    stateMachine = new ConnectionStateMachine(uaEvents);
    incomingCallManager = new IncomingCallManager(uaEvents);
    sipEventHandler = new SipEventHandler(uaEvents);

    // Для некоторых тестов требуется только subscribeToStartEvents
    registrationManager = {
      subscribeToStartEvents: jest.fn(),
    } as unknown as RegistrationManager;

    connectionFlow = new ConnectionFlow({
      JsSIP: jssip as unknown as TJsSIP,
      uaEvents,
      uaFactory,
      stateMachine,
      registrationManager,
      incomingCallManager,
      sipEventHandler,
      getUa,
      setUa,
      getConnectionConfiguration,
      setConnectionConfiguration,
      setSipServerUrl,
      setSocket,
    });
  });

  describe('connect', () => {
    it.only('должен успешно устанавливать соединение и вызывать нужные зависимости', async () => {
      const mockUA = new UAMock({
        uri: 'sip:testuser@sip.example.com',
        register: false,
        sockets: [{}] as unknown as Socket,
      });

      // Параметры подключения
      const parameters = {
        displayName: 'Test User',
        user: 'testuser',
        password: 'testpass',
        register: false,
        sipServerUrl: 'sip.example.com',
        sipWebSocketServerURL: 'wss://sip.example.com:8089/ws',
      } as const;

      const startConnectSpy = jest.spyOn(stateMachine, 'startConnect');
      const startInitUaSpy = jest.spyOn(stateMachine, 'startInitUa');
      const incomingStartSpy = jest.spyOn(incomingCallManager, 'start');
      const sipHandlerStartSpy = jest.spyOn(sipEventHandler, 'start');

      const result = await connectionFlow.connect(parameters);

      expect(result).toBe(mockUA);
      expect(setUa).toHaveBeenCalledWith(mockUA);
      expect(startConnectSpy).toHaveBeenCalled();
      expect(startInitUaSpy).toHaveBeenCalled();
      expect(incomingStartSpy).toHaveBeenCalled();
      expect(sipHandlerStartSpy).toHaveBeenCalled();
    });

    it('должен отменять повторяющиеся запросы при вызове cancelRequests', async () => {
      const mockUA = new UAMock({
        uri: 'sip:testuser@sip.example.com',
        register: false,
        sockets: [{}] as unknown as Socket,
      });

      const cancelMock = jest.fn();

      jest.spyOn(uaFactory, 'createUAWithConfiguration').mockReturnValue({
        ua: mockUA as unknown as UA,
        helpers: {
          socket: {} as unknown as Socket,
          getSipServerUrl: jest.fn(),
        },
      });

      const parametersMinimal: TParametersConnection = {
        sipServerUrl: 'sip.example.com',
        sipWebSocketServerURL: 'wss://sip.example.com:8089/ws',
      };

      await connectionFlow.connect(parametersMinimal);

      // Гарантируем, что свойство cancel присутствует и является функцией
      const promiseWithCancel = (
        connectionFlow as unknown as {
          cancelableConnectWithRepeatedCalls?: { cancel?: () => void };
        }
      ).cancelableConnectWithRepeatedCalls;

      if (promiseWithCancel) {
        promiseWithCancel.cancel = cancelMock;
      }

      connectionFlow.cancelRequests();

      expect(cancelMock).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('должен корректно завершать соединение при наличии UA', async () => {
      const mockUA = new UAMock({
        uri: 'sip:testuser@sip.example.com',
        register: false,
        sockets: [{}] as unknown as Socket,
      });

      uaInstance = mockUA;

      const incomingStopSpy = jest.spyOn(incomingCallManager, 'stop');
      const sipHandlerStopSpy = jest.spyOn(sipEventHandler, 'stop');
      const resetSpy = jest.spyOn(stateMachine, 'reset');

      await connectionFlow.disconnect();

      expect(incomingStopSpy).toHaveBeenCalled();
      expect(sipHandlerStopSpy).toHaveBeenCalled();
      expect(mockUA.stop).toHaveBeenCalled();
      expect(setUa).toHaveBeenCalledWith(undefined);
      expect(resetSpy).toHaveBeenCalled();
      expect(getUa()).toBeUndefined();
    });

    it('должен корректно завершать соединение при отсутствии UA', async () => {
      uaInstance = undefined;

      const resetSpy = jest.spyOn(stateMachine, 'reset');
      const triggerSpy = jest.spyOn(uaEvents, 'trigger');

      const disconnectPromise = connectionFlow.disconnect();

      // Вручную эмитим DISCONNECTED, так как UA нет
      uaEvents.trigger(DISCONNECTED, undefined);

      await disconnectPromise;

      expect(triggerSpy).toHaveBeenCalledWith(DISCONNECTED, undefined);
      expect(setUa).toHaveBeenCalledWith(undefined);
      expect(resetSpy).toHaveBeenCalled();
    });
  });

  describe('connect с регистрацией', () => {
    it('должен использовать RegistrationManager.subscribeToStartEvents при register=true', async () => {
      const mockUAReg = new UAMock({
        uri: 'sip:testuser@sip.example.com',
        register: true,
        password: 'PASSWORD_CORRECT',
        sockets: [{}] as unknown as Socket,
      });

      // Мокаем subscribeToStartEvents так, чтобы onSuccess вызывался синхронно
      const subscribeMock = jest.fn((onSuccess: () => void) => {
        // Вызываем onSuccess асинхронно, чтобы избежать контекстных ошибок
        setTimeout(onSuccess, 0);

        return jest.fn();
      });

      (
        registrationManager as unknown as { subscribeToStartEvents: jest.Mock }
      ).subscribeToStartEvents = subscribeMock;

      const parameters = {
        displayName: 'Test User',
        user: 'testuser',
        password: 'PASSWORD_CORRECT',
        register: true,
        sipServerUrl: 'sip.example.com',
        sipWebSocketServerURL: 'wss://sip.example.com:8089/ws',
      } as const;

      const result = await connectionFlow.connect(parameters);

      expect(result).toBe(mockUAReg);
      expect(subscribeMock).toHaveBeenCalledWith(expect.any(Function), expect.any(Function));
    });
  });
});
