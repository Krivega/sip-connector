import { repeatedCallsAsync } from 'repeated-calls';

import { EEvent } from './events';
import { hasHandshakeWebsocketOpeningError } from '../utils/errors';
import { parseDisplayName } from '../utils/utils';

import type {
  DisconnectEvent,
  Socket,
  UA,
  UnRegisteredEvent,
  WebSocketInterface,
} from '@krivega/jssip';
import type { TGetUri } from '../CallManager';
import type { TConnectionConfiguration } from './ConfigurationManager';
import type { ConnectionStateMachine } from './ConnectionStateMachine';
import type { TEvents } from './events';
import type RegistrationManager from './RegistrationManager';
import type UAFactory from './UAFactory';

const DELAYED_REPEATED_CALLS_CONNECT_LIMIT = 3;

export type TOptionsExtraHeaders = {
  extraHeaders?: string[];
};

export type TParametersConnection = TOptionsExtraHeaders & {
  sipServerIp: string;
  sipServerUrl: string;
  displayName: string;
  register?: boolean;
  user?: string;
  password?: string;
  remoteAddress?: string;
  userAgent?: string;
  sessionTimers?: boolean;
  registerExpires?: number;
  connectionRecoveryMinInterval?: number;
  connectionRecoveryMaxInterval?: number;
};

export type TConnect = (
  parameters: TParametersConnection,
  options?: { callLimit?: number },
) => Promise<TConnectionConfiguration>;

export type TSet = (parameters: { displayName?: string }) => Promise<boolean>;

type TInitUa = (parameters: TParametersConnection) => Promise<UA>;
type TStart = () => Promise<UA>;

interface IDependencies {
  events: TEvents;
  uaFactory: UAFactory;
  stateMachine: ConnectionStateMachine;
  registrationManager: RegistrationManager;
  getUa: () => UA | undefined;
  setUa: (ua: UA | undefined) => void;
  getConnectionConfiguration: () => TConnectionConfiguration | undefined;
  setConnectionConfiguration: (config: TConnectionConfiguration | undefined) => void;
  updateConnectionConfiguration: <K extends keyof TConnectionConfiguration>(
    key: K,
    value: TConnectionConfiguration[K],
  ) => void;
  setGetUri: (getUri: TGetUri) => void;
  setSocket: (socket: WebSocketInterface) => void;
}

export default class ConnectionFlow {
  private cancelableConnectWithRepeatedCalls:
    | ReturnType<typeof repeatedCallsAsync<TConnectionConfiguration>>
    | undefined;

  private readonly events: IDependencies['events'];

  private readonly uaFactory: IDependencies['uaFactory'];

  private readonly stateMachine: IDependencies['stateMachine'];

  private readonly registrationManager: IDependencies['registrationManager'];

  private readonly getUa: IDependencies['getUa'];

  private readonly setUa: IDependencies['setUa'];

  private readonly getConnectionConfiguration: IDependencies['getConnectionConfiguration'];

  private readonly setConnectionConfiguration: IDependencies['setConnectionConfiguration'];

  private readonly updateConnectionConfiguration: IDependencies['updateConnectionConfiguration'];

  private readonly setGetUri: IDependencies['setGetUri'];

  private readonly setSocket: IDependencies['setSocket'];

  public constructor(dependencies: IDependencies) {
    this.events = dependencies.events;
    this.uaFactory = dependencies.uaFactory;
    this.stateMachine = dependencies.stateMachine;
    this.registrationManager = dependencies.registrationManager;
    this.getUa = dependencies.getUa;
    this.setUa = dependencies.setUa;
    this.getConnectionConfiguration = dependencies.getConnectionConfiguration;
    this.setConnectionConfiguration = dependencies.setConnectionConfiguration;
    this.updateConnectionConfiguration = dependencies.updateConnectionConfiguration;
    this.setGetUri = dependencies.setGetUri;
    this.setSocket = dependencies.setSocket;

    this.proxyEvents();
  }

  public connect: TConnect = async (data, options) => {
    this.cancelRequests();

    return this.connectWithDuplicatedCalls(data, options);
  };

  public set: TSet = async ({ displayName }: { displayName?: string }): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      const ua = this.getUa();

      if (!ua) {
        reject(new Error('this.ua is not initialized'));

        return;
      }

      let changedDisplayName = false;
      const connectionConfiguration = this.getConnectionConfiguration();

      if (displayName !== undefined && displayName !== connectionConfiguration?.displayName) {
        changedDisplayName = ua.set('display_name', parseDisplayName(displayName));
        this.updateConnectionConfiguration('displayName', displayName);
      }

      const changedSome = changedDisplayName;

      if (changedSome) {
        resolve(changedSome);
      } else {
        reject(new Error('nothing changed'));
      }
    });
  };

  public disconnect = async () => {
    this.events.trigger(EEvent.DISCONNECTING, {});

    const disconnectedPromise = new Promise<void>((resolve) => {
      this.events.once(EEvent.DISCONNECTED, () => {
        resolve();
      });
    });

    const ua = this.getUa();

    if (ua) {
      ua.stop();
    } else {
      this.events.trigger(EEvent.DISCONNECTED, { socket: {} as Socket, error: false });
    }

    return disconnectedPromise.finally(() => {
      ua?.removeAllListeners();
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

    this.cancelableConnectWithRepeatedCalls = repeatedCallsAsync<TConnectionConfiguration>({
      targetFunction,
      isComplete,
      callLimit,
      isRejectAsValid: true,
      isCheckBeforeCall: false,
    });

    return this.cancelableConnectWithRepeatedCalls.then((response?: unknown) => {
      if (typeof response === 'object' && response !== null && 'authorizationUser' in response) {
        return response as TConnectionConfiguration;
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
    return this.initUa(parameters)
      .then(async () => {
        return this.start();
      })
      .then(() => {
        const connectionConfiguration = this.getConnectionConfiguration();

        if (connectionConfiguration === undefined) {
          throw new Error('connectionConfiguration has not defined');
        }

        return connectionConfiguration;
      });
  };

  private readonly initUa: TInitUa = async ({
    user,
    password,
    sipServerIp,
    sipServerUrl,
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
        sipServerIp,
        sipServerUrl,
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
      this.events,
    );

    const authorizationUser = ua.configuration.uri.user;

    // Сохраняем конфигурацию для дальнейшего использования
    this.setConnectionConfiguration({
      sipServerIp,
      sipServerUrl,
      displayName,
      authorizationUser,
      register,
      user,
      password,
    });

    // Сохраняем UA и связанные объекты
    this.setUa(ua);
    this.setGetUri(helpers.getUri);
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

      let unsubscribeFromEvents: undefined | (() => void);

      const resolveUa = () => {
        unsubscribeFromEvents?.();
        resolve(ua);
      };

      const rejectError = (error: DisconnectEvent | UnRegisteredEvent) => {
        unsubscribeFromEvents?.();
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        reject(error);
      };

      const subscribeToStartEvents = (
        onSuccess: () => void,
        onError: (error: DisconnectEvent | UnRegisteredEvent) => void,
      ) => {
        const connectionConfig = this.getConnectionConfiguration();

        if (connectionConfig?.register === true) {
          return this.registrationManager.subscribeToStartEvents(onSuccess, onError);
        }

        const successEvent = EEvent.CONNECTED;
        const errorEvents = [EEvent.DISCONNECTED] as const;

        // Подписываемся на события
        this.events.on(successEvent, onSuccess);
        errorEvents.forEach((errorEvent) => {
          this.events.on(errorEvent, onError);
        });

        // Возвращаем функцию для отписки
        return () => {
          this.events.off(successEvent, onSuccess);
          errorEvents.forEach((errorEvent) => {
            this.events.off(errorEvent, onError);
          });
        };
      };

      unsubscribeFromEvents = subscribeToStartEvents(resolveUa, rejectError);

      ua.start();
    });
  };

  private cancelConnectWithRepeatedCalls() {
    this.cancelableConnectWithRepeatedCalls?.cancel();
  }

  private proxyEvents() {
    this.events.on(EEvent.CONNECTED, () => {
      const connectionConfiguration = this.getConnectionConfiguration();

      if (connectionConfiguration !== undefined) {
        this.events.trigger(EEvent.CONNECTED_WITH_CONFIGURATION, connectionConfiguration);
      }
    });
  }
}
