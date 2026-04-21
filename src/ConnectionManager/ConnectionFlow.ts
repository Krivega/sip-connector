import { CancelableRequest, isCanceledError } from '@krivega/cancelable-promise';
import { repeatedCallsAsync } from 'repeated-calls';

import { resolveParameters } from './utils';
import { hasHandshakeWebsocketOpeningError } from '../utils/errors';

import type {
  DisconnectEvent,
  Socket,
  UA,
  UnRegisteredEvent,
  WebSocketInterface,
} from '@krivega/jssip';
import type { TGetUri } from '../CallManager';
import type { ConnectionStateMachine } from './ConnectionStateMachine';
import type { TEvents } from './events';
import type RegistrationManager from './RegistrationManager';
import type { TConnectionConfiguration, TParametersConnection } from './types';
import type UAFactory from './UAFactory';

const NUMBER_OF_CONNECTION_ATTEMPTS = 3;

type TConnectParameters = (() => Promise<TParametersConnection>) | TParametersConnection;

export type TConnect = (
  parameters: TConnectParameters,
  options?: { numberOfConnectionAttempts?: number },
) => Promise<TConnectionConfiguration>;

type TConnectResolved = (
  parameters: TParametersConnection,
  options?: { numberOfConnectionAttempts?: number },
) => Promise<TConnectionConfiguration>;

type TInitUa = (
  parameters: TParametersConnection,
) => Promise<{ ua: UA; configuration: TConnectionConfiguration }>;
type TStart = (configuration: TConnectionConfiguration) => Promise<TConnectionConfiguration>;

interface IDependencies {
  events: TEvents;
  uaFactory: UAFactory;
  stateMachine: ConnectionStateMachine;
  registrationManager: RegistrationManager;
  getUa: () => UA | undefined;
  setUa: (ua: UA | undefined) => void;
  setGetUri: (getUri: TGetUri) => void;
  setSocket: (socket: WebSocketInterface) => void;
}

export default class ConnectionFlow {
  private readonly resolveParametersRequester = new CancelableRequest<
    TConnectParameters,
    TParametersConnection
  >(resolveParameters);

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
    this.dependencies.stateMachine.toStartConnect();
    this.dependencies.events.trigger('connect-started', {});
    this.cancelRequests();

    return this.resolveParametersRequester
      .request(parameters)
      .then((data) => {
        this.dependencies.events.trigger('connect-parameters-resolve-success', data);

        return data;
      })
      .catch((error: unknown) => {
        this.dependencies.events.trigger('connect-parameters-resolve-failed', error);

        throw error;
      })
      .then(async (data) => {
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

        if (!isCanceledError(connectError)) {
          this.dependencies.events.trigger('connect-failed', connectError);
        }

        throw connectError;
      });
  };

  public disconnect = async ({ cancelRequests = true }: { cancelRequests?: boolean } = {}) => {
    if (cancelRequests) {
      this.cancelRequests();
    }

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
    this.resolveParametersRequester.cancelRequest();
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
    return this.initUa(parameters).then(async ({ configuration }) => {
      return this.start(configuration);
    });
  };

  private readonly initUa: TInitUa = async ({
    user,
    password,
    sipServerIp,
    sipServerUrl,
    remoteAddress,
    iceServers,
    sessionTimers,
    registerExpires,
    connectionRecoveryMinInterval,
    connectionRecoveryMaxInterval,
    userAgent,
    displayName = '',
    register = false,
    extraHeaders = [],
  }) => {
    // Отключаем текущее соединение, если оно есть
    const currentUa = this.dependencies.getUa();

    if (currentUa) {
      await this.disconnect({ cancelRequests: false });
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

    // Сохраняем UA и связанные объекты
    this.dependencies.setUa(ua);
    this.dependencies.setGetUri(helpers.getUri);
    this.dependencies.setSocket(helpers.socket);

    const authorizationUser = ua.configuration.uri.user;

    const configuration = {
      sipServerIp,
      sipServerUrl,
      remoteAddress,
      iceServers,
      displayName,
      authorizationUser,
      register,
      user,
      password,
    };

    return { ua, configuration };
  };

  private readonly start: TStart = async (configuration) => {
    return new Promise((resolve, reject) => {
      const ua = this.dependencies.getUa();

      if (!ua) {
        reject(new Error('this.ua is not initialized'));

        return;
      }

      let unsubscribeFromEvents: undefined | (() => void);

      const resolveUa = () => {
        unsubscribeFromEvents?.();
        resolve(configuration);
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
        if (configuration.register === true) {
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

      this.dependencies.stateMachine.toStartUa(configuration);

      ua.start();
    });
  };

  private cancelConnectWithRepeatedCalls() {
    this.cancelableConnectWithRepeatedCalls?.cancel();
  }

  private proxyEvents() {
    this.dependencies.events.on('connected', () => {
      const connectionConfiguration = this.dependencies.stateMachine.getConnectionConfiguration();

      if (connectionConfiguration !== undefined) {
        this.dependencies.events.trigger('connected-with-configuration', connectionConfiguration);
      }
    });
  }
}
