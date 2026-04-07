import { repeatedCallsAsync } from 'repeated-calls';

import { resolveParameters } from './utils';
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

const NUMBER_OF_CONNECTION_ATTEMPTS = 3;

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

type TConnectParameters = (() => Promise<TParametersConnection>) | TParametersConnection;

export type TConnect = (
  parameters: TConnectParameters,
  options?: { numberOfConnectionAttempts?: number },
) => Promise<TConnectionConfiguration>;

type TConnectResolved = (
  parameters: TParametersConnection,
  options?: { numberOfConnectionAttempts?: number },
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

  private readonly numberOfConnectionAttempts: number;

  private readonly dependencies: IDependencies;

  public constructor(
    dependencies: IDependencies,
    {
      numberOfConnectionAttempts = NUMBER_OF_CONNECTION_ATTEMPTS,
    }: {
      numberOfConnectionAttempts?: number;
    } = {},
  ) {
    this.dependencies = dependencies;
    this.numberOfConnectionAttempts = numberOfConnectionAttempts;

    this.proxyEvents();
  }

  public connect: TConnect = async (parameters, options) => {
    this.dependencies.events.trigger('connect-started', {});

    return resolveParameters(parameters)
      .then((data) => {
        this.dependencies.events.trigger('connect-parameters-resolve-success', data);

        return data;
      })
      .catch((error: unknown) => {
        this.dependencies.events.trigger('connect-parameters-resolve-failed', error);

        throw error;
      })
      .then(async (data) => {
        this.cancelRequests();

        return this.connectWithDuplicatedCalls(data, options);
      })
      .then((connectionConfigurationWithUa) => {
        this.dependencies.events.trigger('connect-succeeded', {
          ...connectionConfigurationWithUa,
        });

        return connectionConfigurationWithUa;
      })
      .catch((error: unknown) => {
        const connectError: unknown = error ?? new Error('Failed to connect to server');

        this.dependencies.events.trigger('connect-failed', connectError);

        throw connectError;
      });
  };

  public set: TSet = async ({ displayName }: { displayName?: string }): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      const ua = this.dependencies.getUa();

      if (!ua) {
        reject(new Error('this.ua is not initialized'));

        return;
      }

      let changedDisplayName = false;
      const connectionConfiguration = this.dependencies.getConnectionConfiguration();

      if (displayName !== undefined && displayName !== connectionConfiguration?.displayName) {
        changedDisplayName = ua.set('display_name', parseDisplayName(displayName));
        this.dependencies.updateConnectionConfiguration('displayName', displayName);
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
    this.dependencies.events.trigger('disconnecting', {});

    const disconnectedPromise = new Promise<void>((resolve) => {
      this.dependencies.events.once('disconnected', () => {
        resolve();
      });
    });

    const ua = this.dependencies.getUa();

    if (ua) {
      ua.stop();
    } else {
      this.dependencies.events.trigger('disconnected', { socket: {} as Socket, error: false });
    }

    return disconnectedPromise.finally(() => {
      ua?.removeAllListeners();
      this.dependencies.setUa(undefined);
      this.dependencies.stateMachine.reset(); // Возвращаем в idle состояние
    });
  };

  public cancelRequests() {
    this.cancelConnectWithRepeatedCalls();
  }

  private readonly connectWithDuplicatedCalls: TConnectResolved = async (
    data,
    { numberOfConnectionAttempts = this.numberOfConnectionAttempts } = {},
  ) => {
    const targetFunction = async () => {
      return this.connectInner(data);
    };

    const isComplete = (response?: unknown): boolean => {
      const ua = this.dependencies.getUa();
      const isConnected = ua?.isConnected() === true;
      const isValidResponse = isConnected && this.hasEqualConnectionConfiguration(data);
      const isValidError =
        response !== undefined && response !== null && !hasHandshakeWebsocketOpeningError(response);

      return isValidResponse || isValidError;
    };

    this.dependencies.stateMachine.startConnect();

    this.cancelableConnectWithRepeatedCalls = repeatedCallsAsync<TConnectionConfiguration>({
      targetFunction,
      isComplete,
      callLimit: numberOfConnectionAttempts,
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
    const { configuration: newConfiguration } =
      this.dependencies.uaFactory.createConfiguration(parameters);

    const ua = this.dependencies.getUa();
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

  private readonly connectInner: TConnectResolved = async (parameters) => {
    return this.initUa(parameters)
      .then(async () => {
        return this.start();
      })
      .then(() => {
        const connectionConfiguration = this.dependencies.getConnectionConfiguration();

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
    this.dependencies.stateMachine.startInitUa();

    // Отключаем текущее соединение, если оно есть
    const currentUa = this.dependencies.getUa();

    if (currentUa) {
      await this.disconnect();
    }

    // Создаем UA с полной конфигурацией и событиями через UAFactory
    // Валидация происходит внутри UAFactory.createConfiguration
    const { ua, helpers } = this.dependencies.uaFactory.createUAWithConfiguration(
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
      this.dependencies.events,
    );

    const authorizationUser = ua.configuration.uri.user;

    // Сохраняем конфигурацию для дальнейшего использования
    this.dependencies.setConnectionConfiguration({
      sipServerIp,
      sipServerUrl,
      displayName,
      authorizationUser,
      register,
      user,
      password,
    });

    // Сохраняем UA и связанные объекты
    this.dependencies.setUa(ua);
    this.dependencies.setGetUri(helpers.getUri);
    this.dependencies.setSocket(helpers.socket);

    return ua;
  };

  private readonly start: TStart = async () => {
    return new Promise((resolve, reject) => {
      const ua = this.dependencies.getUa();

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
        const connectionConfig = this.dependencies.getConnectionConfiguration();

        if (connectionConfig?.register === true) {
          return this.dependencies.registrationManager.subscribeToStartEvents(onSuccess, onError);
        }

        const successEvent = 'connected';
        const errorEvents = ['disconnected'] as const;

        // Подписываемся на события
        this.dependencies.events.on(successEvent, onSuccess);
        errorEvents.forEach((errorEvent) => {
          this.dependencies.events.on(errorEvent, onError);
        });

        // Возвращаем функцию для отписки
        return () => {
          this.dependencies.events.off(successEvent, onSuccess);
          errorEvents.forEach((errorEvent) => {
            this.dependencies.events.off(errorEvent, onError);
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
    this.dependencies.events.on('connected', () => {
      const connectionConfiguration = this.dependencies.getConnectionConfiguration();

      if (connectionConfiguration !== undefined) {
        this.dependencies.events.trigger('connected-with-configuration', connectionConfiguration);
      }
    });
  }
}
