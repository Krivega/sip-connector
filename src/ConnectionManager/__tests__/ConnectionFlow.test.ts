import type { UA } from '@krivega/jssip';
import Events from 'events-constructor';
import jssip from '../../__fixtures__/jssip.mock';
import UAMock, {
  PASSWORD_CORRECT,
  createWebsocketHandshakeTimeoutError,
} from '../../__fixtures__/UA.mock';
import { DISCONNECTED } from '../../constants';
import { UA_EVENT_NAMES } from '../../eventNames';
import type { TJsSIP } from '../../types';
import ConnectionFlow from '../ConnectionFlow';
import ConnectionStateMachine from '../ConnectionStateMachine';
import IncomingCallManager from '../IncomingCallManager';
import RegistrationManager from '../RegistrationManager';
import SipEventHandler from '../SipEventHandler';
import UAFactory from '../UAFactory';

const SIP_SERVER_URL = 'sip.example.com';
const websocketHandshakeTimeoutError = createWebsocketHandshakeTimeoutError(SIP_SERVER_URL);

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
    jest.clearAllMocks();
    UAMock.reset();

    connectionConfiguration = {};
    uaInstance = undefined;

    uaEvents = new Events<typeof UA_EVENT_NAMES>(UA_EVENT_NAMES);
    uaFactory = new UAFactory(jssip as unknown as TJsSIP);
    stateMachine = new ConnectionStateMachine(uaEvents);
    incomingCallManager = new IncomingCallManager(uaEvents);
    sipEventHandler = new SipEventHandler(uaEvents);
    registrationManager = new RegistrationManager({
      uaEvents,
      getUa,
    });

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
    it('должен успешно устанавливать соединение и вызывать нужные зависимости без регистрации', async () => {
      const configuration = {
        password: undefined,
        register: false,
        register_expires: 300,
        sdpSemantics: 'unified-plan',
        session_timers: false,
        sockets: [
          {
            url: 'wss://sip.example.com:8089/ws',
          },
        ],
        uri: {
          _headers: {},
          _host: SIP_SERVER_URL,
          _parameters: {},
          _port: undefined,
          _scheme: 'sip',
          _user: 'testuser',
        },
        user_agent: undefined,
        connection_recovery_max_interval: 6,
        connection_recovery_min_interval: 2,
        display_name: 'Test_User',
      } as const;

      const parameters = {
        displayName: 'Test User',
        register: false,
        sipServerUrl: SIP_SERVER_URL,
        sipWebSocketServerURL: 'wss://sip.example.com:8089/ws',
      } as const;

      const startConnectSpy = jest.spyOn(stateMachine, 'startConnect');
      const startInitUaSpy = jest.spyOn(stateMachine, 'startInitUa');
      const incomingStartSpy = jest.spyOn(incomingCallManager, 'start');
      const sipHandlerStartSpy = jest.spyOn(sipEventHandler, 'start');

      const result = await connectionFlow.connect(parameters);

      // копируем юзер из результата в конфигурацию, чтобы тест прошел
      // так как user генерируется случайно
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, no-underscore-dangle
      configuration.uri._user = result.configuration.uri._user;

      expect(result.configuration).toEqual(configuration);
      expect(setUa).toHaveBeenCalled();
      expect(startConnectSpy).toHaveBeenCalled();
      expect(startInitUaSpy).toHaveBeenCalled();
      expect(incomingStartSpy).toHaveBeenCalled();
      expect(sipHandlerStartSpy).toHaveBeenCalled();
    });

    it('должен успешно устанавливать соединение и вызывать нужные зависимости с регистрацией', async () => {
      const configuration = {
        password: PASSWORD_CORRECT,
        register: true,
        register_expires: 300,
        sdpSemantics: 'unified-plan',
        session_timers: false,
        sockets: [
          {
            url: 'wss://sip.example.com:8089/ws',
          },
        ],
        uri: {
          _headers: {},
          _host: SIP_SERVER_URL,
          _parameters: {},
          _port: undefined,
          _scheme: 'sip',
          _user: 'testuser',
        },
        user_agent: undefined,
        connection_recovery_max_interval: 6,
        connection_recovery_min_interval: 2,
        display_name: 'Test_User',
      } as const;

      const parameters = {
        displayName: 'Test User',
        user: 'testuser',
        password: PASSWORD_CORRECT,
        register: true,
        sipServerUrl: SIP_SERVER_URL,
        sipWebSocketServerURL: 'wss://sip.example.com:8089/ws',
      } as const;

      const startConnectSpy = jest.spyOn(stateMachine, 'startConnect');
      const startInitUaSpy = jest.spyOn(stateMachine, 'startInitUa');
      const incomingStartSpy = jest.spyOn(incomingCallManager, 'start');
      const sipHandlerStartSpy = jest.spyOn(sipEventHandler, 'start');

      const result = await connectionFlow.connect(parameters);

      expect(result.configuration).toEqual(configuration);
      expect(setUa).toHaveBeenCalled();
      expect(startConnectSpy).toHaveBeenCalled();
      expect(startInitUaSpy).toHaveBeenCalled();
      expect(incomingStartSpy).toHaveBeenCalled();
      expect(sipHandlerStartSpy).toHaveBeenCalled();
    });

    it('должен отменять повторяющиеся запросы при вызове cancelRequests', async () => {
      UAMock.setStartError(websocketHandshakeTimeoutError, { count: 2 });

      const parameters = {
        displayName: 'Test User',
        register: false,
        sipServerUrl: SIP_SERVER_URL,
        sipWebSocketServerURL: 'wss://sip.example.com:8089/ws',
      } as const;

      // @ts-expect-error
      const requestConnectMocked = jest.spyOn(connectionFlow, 'connectInner');

      await connectionFlow.connect(parameters);

      connectionFlow.cancelRequests();

      expect(requestConnectMocked).toHaveBeenCalledTimes(2);

      await new Promise((resolve) => {
        setTimeout(resolve, 1000);
      });

      expect(requestConnectMocked).toHaveBeenCalledTimes(2);
    });
  });

  describe('disconnect', () => {
    it('должен корректно завершать соединение при наличии UA', async () => {
      const uaMock = uaFactory.createUAWithConfiguration(
        {
          register: false,
          sipServerUrl: SIP_SERVER_URL,
          sipWebSocketServerURL: 'wss://sip.example.com:8089/ws',
        },
        uaEvents,
      ).ua as unknown as UAMock;

      uaInstance = uaMock;

      const incomingStopSpy = jest.spyOn(incomingCallManager, 'stop');
      const sipHandlerStopSpy = jest.spyOn(sipEventHandler, 'stop');
      const resetSpy = jest.spyOn(stateMachine, 'reset');

      await connectionFlow.disconnect();

      expect(incomingStopSpy).toHaveBeenCalled();
      expect(sipHandlerStopSpy).toHaveBeenCalled();
      expect(uaMock.stop).toHaveBeenCalled();
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
});
