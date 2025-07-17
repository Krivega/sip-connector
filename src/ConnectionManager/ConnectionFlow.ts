import type { UA, WebSocketInterface } from '@krivega/jssip';
import type Events from 'events-constructor';
import { repeatedCallsAsync } from 'repeated-calls';
import { CONNECTED, DISCONNECTED } from '../constants';
import type { UA_EVENT_NAMES } from '../eventNames';
import type { TGetServerUrl, TJsSIP } from '../types';
import { hasHandshakeWebsocketOpeningError } from '../utils/errors';
import type ConnectionStateMachine from './ConnectionStateMachine';
import type IncomingCallManager from './IncomingCallManager';
import type RegistrationManager from './RegistrationManager';
import type SipEventHandler from './SipEventHandler';
import type UAFactory from './UAFactory';

const DELAYED_REPEATED_CALLS_CONNECT_LIMIT = 3;

export type TOptionsExtraHeaders = {
  extraHeaders?: string[];
};

export type TParametersConnection = TOptionsExtraHeaders & {
  displayName?: string;
  user?: string;
  password?: string;
  register?: boolean;
  sipServerUrl: string;
  sipWebSocketServerURL: string;
  remoteAddress?: string;
  sessionTimers?: boolean;
  registerExpires?: number;
  connectionRecoveryMinInterval?: number;
  connectionRecoveryMaxInterval?: number;
  userAgent?: string;
};

export type TConnect = (
  parameters: TParametersConnection,
  options?: { callLimit?: number },
) => Promise<UA>;

type TInitUa = (parameters: TParametersConnection) => Promise<UA>;
type TStart = () => Promise<UA>;

interface IDependencies {
  JsSIP: TJsSIP;
  uaEvents: Events<typeof UA_EVENT_NAMES>;
  uaFactory: UAFactory;
  stateMachine: ConnectionStateMachine;
  registrationManager: RegistrationManager;
  incomingCallManager: IncomingCallManager;
  sipEventHandler: SipEventHandler;
  getUa: () => UA | undefined;
  setUa: (ua: UA | undefined) => void;
  getConnectionConfiguration: () => {
    sipServerUrl?: string;
    displayName?: string;
    register?: boolean;
    user?: string;
    password?: string;
  };
  setConnectionConfiguration: (config: {
    sipServerUrl?: string;
    displayName?: string;
    register?: boolean;
    user?: string;
    password?: string;
  }) => void;
  setSipServerUrl: (getSipServerUrl: TGetServerUrl) => void;
  setSocket: (socket: WebSocketInterface) => void;
}

export default class ConnectionFlow {
  private cancelableConnectWithRepeatedCalls: ReturnType<typeof repeatedCallsAsync<UA>> | undefined;

  private readonly JsSIP: IDependencies['JsSIP'];

  private readonly uaEvents: IDependencies['uaEvents'];

  private readonly uaFactory: IDependencies['uaFactory'];

  private readonly stateMachine: IDependencies['stateMachine'];

  private readonly registrationManager: IDependencies['registrationManager'];

  private readonly incomingCallManager: IDependencies['incomingCallManager'];

  private readonly sipEventHandler: IDependencies['sipEventHandler'];

  private readonly getUa: IDependencies['getUa'];

  private readonly setUa: IDependencies['setUa'];

  private readonly getConnectionConfiguration: IDependencies['getConnectionConfiguration'];

  private readonly setConnectionConfiguration: IDependencies['setConnectionConfiguration'];

  private readonly setSipServerUrl: IDependencies['setSipServerUrl'];

  private readonly setSocket: IDependencies['setSocket'];

  public constructor(dependencies: IDependencies) {
    this.JsSIP = dependencies.JsSIP;
    this.uaEvents = dependencies.uaEvents;
    this.uaFactory = dependencies.uaFactory;
    this.stateMachine = dependencies.stateMachine;
    this.registrationManager = dependencies.registrationManager;
    this.incomingCallManager = dependencies.incomingCallManager;
    this.sipEventHandler = dependencies.sipEventHandler;
    this.getUa = dependencies.getUa;
    this.setUa = dependencies.setUa;
    this.getConnectionConfiguration = dependencies.getConnectionConfiguration;
    this.setConnectionConfiguration = dependencies.setConnectionConfiguration;
    this.setSipServerUrl = dependencies.setSipServerUrl;
    this.setSocket = dependencies.setSocket;
  }

  public connect: TConnect = async (data, options) => {
    this.cancelRequests();

    return this.connectWithDuplicatedCalls(data, options);
  };

  public disconnect = async () => {
    this.incomingCallManager.stop();
    this.sipEventHandler.stop();

    const disconnectedPromise = new Promise<void>((resolve) => {
      this.uaEvents.once(DISCONNECTED, () => {
        resolve();
      });
    });

    const ua = this.getUa();

    if (ua) {
      ua.stop();
    } else {
      this.uaEvents.trigger(DISCONNECTED, undefined);
    }

    return disconnectedPromise.finally(() => {
      this.setUa(undefined);
      this.stateMachine.reset(); // Возвращаем в idle состояние
    });
  };

  public cancelRequests() {
    this.cancelConnectWithRepeatedCalls();
  }

  private readonly connectWithDuplicatedCalls: TConnect = async (
    data,
    { callLimit = DELAYED_REPEATED_CALLS_CONNECT_LIMIT } = {},
  ) => {
    const targetFunction = async () => {
      return this.connectInner(data);
    };

    const isComplete = (response?: unknown): boolean => {
      const ua = this.getUa();
      const isConnected = ua?.isConnected() === true;
      const isValidResponse = isConnected && this.hasEqualConnectionConfiguration(data);
      const isValidError =
        response !== undefined && response !== null && !hasHandshakeWebsocketOpeningError(response);

      return isValidResponse || isValidError;
    };

    this.stateMachine.startConnect();

    this.cancelableConnectWithRepeatedCalls = repeatedCallsAsync<UA>({
      targetFunction,
      isComplete,
      callLimit,
      isRejectAsValid: true,
      isCheckBeforeCall: false,
    });

    return this.cancelableConnectWithRepeatedCalls.then((response?: unknown) => {
      if (response instanceof this.JsSIP.UA) {
        return response;
      }

      throw response;
    });
  };

  private hasEqualConnectionConfiguration(parameters: TParametersConnection) {
    const { configuration: newConfiguration } = this.uaFactory.createConfiguration(parameters);

    const ua = this.getUa();
    const uaConfiguration = ua?.configuration;

    if (!uaConfiguration) {
      return false;
    }

    return (
      uaConfiguration.password === newConfiguration.password &&
      uaConfiguration.register === newConfiguration.register &&
      uaConfiguration.uri.toString() === newConfiguration.uri &&
      uaConfiguration.display_name === newConfiguration.display_name &&
      uaConfiguration.user_agent === newConfiguration.user_agent &&
      uaConfiguration.sockets === newConfiguration.sockets &&
      uaConfiguration.session_timers === newConfiguration.session_timers &&
      uaConfiguration.register_expires === newConfiguration.register_expires &&
      uaConfiguration.connection_recovery_min_interval ===
        newConfiguration.connection_recovery_min_interval &&
      uaConfiguration.connection_recovery_max_interval ===
        newConfiguration.connection_recovery_max_interval
    );
  }

  private readonly connectInner: TConnect = async (parameters) => {
    return this.initUa(parameters).then(async () => {
      return this.start();
    });
  };

  private readonly initUa: TInitUa = async ({
    user,
    password,
    sipServerUrl,
    sipWebSocketServerURL,
    remoteAddress,
    sessionTimers,
    registerExpires,
    connectionRecoveryMinInterval,
    connectionRecoveryMaxInterval,
    userAgent,
    displayName = '',
    register = false,
    extraHeaders = [],
  }) => {
    this.stateMachine.startInitUa();

    // Сохраняем конфигурацию для дальнейшего использования
    this.setConnectionConfiguration({
      sipServerUrl,
      displayName,
      register,
      user,
      password,
    });

    // Отключаем текущее соединение, если оно есть
    const currentUa = this.getUa();

    if (currentUa) {
      await this.disconnect();
    }

    // Создаем UA с полной конфигурацией и событиями через UAFactory
    // Валидация происходит внутри UAFactory.createConfiguration
    const { ua, helpers } = this.uaFactory.createUAWithConfiguration(
      {
        user,
        password,
        sipServerUrl,
        sipWebSocketServerURL,
        displayName,
        register,
        sessionTimers,
        registerExpires,
        connectionRecoveryMinInterval,
        connectionRecoveryMaxInterval,
        userAgent,
        remoteAddress,
        extraHeaders,
      },
      this.uaEvents,
    );

    // Сохраняем UA и связанные объекты
    this.setUa(ua);
    this.setSipServerUrl(helpers.getSipServerUrl);
    this.setSocket(helpers.socket);

    return ua;
  };

  private readonly start: TStart = async () => {
    return new Promise((resolve, reject) => {
      const ua = this.getUa();

      if (!ua) {
        reject(new Error('this.ua is not initialized'));

        return;
      }

      const resolveUa = () => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        unsubscribeFromEvents();
        resolve(ua);
      };

      const rejectError = (error: Error) => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        unsubscribeFromEvents();
        reject(error);
      };

      const subscribeToStartEvents = (onSuccess: () => void, onError: (error: Error) => void) => {
        const connectionConfig = this.getConnectionConfiguration();

        if (connectionConfig.register === true) {
          return this.registrationManager.subscribeToStartEvents(onSuccess, onError);
        }

        const successEvent = CONNECTED;
        const errorEvents = [DISCONNECTED] as const;

        // Подписываемся на события
        this.uaEvents.on(successEvent, onSuccess);
        errorEvents.forEach((errorEvent) => {
          this.uaEvents.on(errorEvent, onError);
        });

        // Возвращаем функцию для отписки
        return () => {
          this.uaEvents.off(successEvent, onSuccess);
          errorEvents.forEach((errorEvent) => {
            this.uaEvents.off(errorEvent, onError);
          });
        };
      };

      const unsubscribeFromEvents = subscribeToStartEvents(resolveUa, rejectError);

      this.incomingCallManager.start();
      this.sipEventHandler.start();

      ua.start();
    });
  };

  private cancelConnectWithRepeatedCalls() {
    this.cancelableConnectWithRepeatedCalls?.cancel();
  }
}
