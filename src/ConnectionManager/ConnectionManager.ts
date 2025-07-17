import type {
  RegisteredEvent,
  UA,
  URI,
  UnRegisteredEvent,
  WebSocketInterface,
} from '@krivega/jssip';
import Events from 'events-constructor';
import { repeatedCallsAsync } from 'repeated-calls';
import { CONNECTED, DISCONNECTED } from '../constants';
import type { TEventUA } from '../eventNames';
import { UA_EVENT_NAMES, UA_JSSIP_EVENT_NAMES } from '../eventNames';
import type { TGetServerUrl, TJsSIP } from '../types';
import { hasHandshakeWebsocketOpeningError } from '../utils/errors';
import IncomingCallManager from './IncomingCallManager';
import RegistrationManager from './RegistrationManager';
import SipEventHandler from './SipEventHandler';
import UAFactory from './UAFactory';

const DELAYED_REPEATED_CALLS_CONNECT_LIMIT = 3;

type TOptionsExtraHeaders = {
  extraHeaders?: string[];
};

type TParametersConnection = TOptionsExtraHeaders & {
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

type TParametersCheckTelephony = {
  displayName: string;
  sipServerUrl: string;
  sipWebSocketServerURL: string;
  userAgent?: string;
  remoteAddress?: string;
  extraHeaders?: string[];
};

type TConnect = (
  parameters: TParametersConnection,
  options?: { callLimit?: number },
) => Promise<UA>;
type TInitUa = (parameters: TParametersConnection) => Promise<UA>;
type TStart = () => Promise<UA>;

export default class ConnectionManager {
  public ua?: UA;

  public socket?: WebSocketInterface;

  private readonly incomingCallManager: IncomingCallManager;

  private readonly sipEventHandler: SipEventHandler;

  private readonly uaFactory: UAFactory;

  private readonly registrationManager: RegistrationManager;

  private connectionConfiguration: {
    sipServerUrl?: string;
    displayName?: string;
    register?: boolean;
    user?: string;
    password?: string;
  } = {};

  private readonly JsSIP: TJsSIP;

  private readonly uaEvents: Events<typeof UA_EVENT_NAMES>;

  private cancelableConnectWithRepeatedCalls: ReturnType<typeof repeatedCallsAsync<UA>> | undefined;

  private isPendingConnect = false;

  private isPendingInitUa = false;

  public constructor({ JsSIP }: { JsSIP: TJsSIP }) {
    this.JsSIP = JsSIP;

    this.uaEvents = new Events<typeof UA_EVENT_NAMES>(UA_EVENT_NAMES);
    this.incomingCallManager = new IncomingCallManager(this.uaEvents);
    this.sipEventHandler = new SipEventHandler(this.uaEvents);
    this.uaFactory = new UAFactory(JsSIP);
    this.registrationManager = new RegistrationManager(this.uaEvents);
  }

  public get requested() {
    return this.isPendingInitUa || this.isPendingConnect;
  }

  public get isRegistered() {
    return UAFactory.isRegisteredUA(this.ua);
  }

  public get isRegisterConfig() {
    return this.connectionConfiguration.register;
  }

  public get remoteCallerData() {
    return this.incomingCallManager.remoteCallerData;
  }

  public get isAvailableIncomingCall() {
    return this.incomingCallManager.isAvailableIncomingCall;
  }

  public connect: TConnect = async (data, options) => {
    this.cancelRequests();

    return this.connectWithDuplicatedCalls(data, options);
  };

  public async register(): Promise<RegisteredEvent> {
    if (!this.ua) {
      throw new Error('UA is not initialized');
    }

    return this.registrationManager.register(this.ua);
  }

  public async unregister(): Promise<UnRegisteredEvent> {
    if (!this.ua) {
      throw new Error('UA is not initialized');
    }

    return this.registrationManager.unregister(this.ua);
  }

  public readonly tryRegister = async () => {
    if (!this.ua) {
      throw new Error('UA is not initialized');
    }

    return this.registrationManager.tryRegister(this.ua);
  };

  public async sendOptions(
    target: URI | string,
    body?: string,
    extraHeaders?: string[],
  ): Promise<void> {
    if (!this.ua) {
      throw new Error('is not connected');
    }

    return new Promise((resolve, reject) => {
      try {
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        this.ua.sendOptions(target, body, {
          extraHeaders,
          eventHandlers: {
            succeeded: () => {
              resolve();
            },
            failed: reject,
          },
        });
      } catch (error) {
        reject(error as Error);
      }
    });
  }

  public async ping(body?: string, extraHeaders?: string[]): Promise<void> {
    if (!this.ua?.configuration.uri) {
      throw new Error('is not connected');
    }

    const target = this.ua.configuration.uri;

    return this.sendOptions(target, body, extraHeaders);
  }

  public async checkTelephony({
    userAgent,
    displayName,
    sipServerUrl,
    sipWebSocketServerURL,
    remoteAddress,
    extraHeaders,
  }: TParametersCheckTelephony): Promise<void> {
    return new Promise<void>((resolve: () => void, reject: (error: Error) => void) => {
      const { configuration } = this.uaFactory.createConfiguration({
        sipWebSocketServerURL,
        displayName,
        userAgent,
        sipServerUrl,
      });

      const ua = this.uaFactory.createUA({ ...configuration, remoteAddress, extraHeaders });

      const rejectWithError = () => {
        const error = new Error('Telephony is not available');

        reject(error);
      };

      ua.once(DISCONNECTED, rejectWithError);

      const stopAndResolveAfterDisconnect = () => {
        ua.removeAllListeners();
        ua.once(DISCONNECTED, resolve);

        ua.stop();
      };

      ua.once(CONNECTED, stopAndResolveAfterDisconnect);

      ua.start();
    });
  }

  public declineToIncomingCall = async ({ statusCode }: { statusCode?: number } = {}) => {
    return this.incomingCallManager.declineToIncomingCall({ statusCode });
  };

  public busyIncomingCall = async () => {
    return this.incomingCallManager.busyIncomingCall();
  };

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public on<T>(eventName: TEventUA, handler: (data: T) => void) {
    return this.uaEvents.on<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public once<T>(eventName: TEventUA, handler: (data: T) => void) {
    return this.uaEvents.once<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public onceRace<T>(eventNames: TEventUA[], handler: (data: T, eventName: string) => void) {
    return this.uaEvents.onceRace<T>(eventNames, handler);
  }

  public async wait<T>(eventName: TEventUA): Promise<T> {
    return this.uaEvents.wait<T>(eventName);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public off<T>(eventName: TEventUA, handler: (data: T) => void) {
    this.uaEvents.off<T>(eventName, handler);
  }

  public isConfigured() {
    return !!this.ua;
  }

  public getConnectionConfiguration() {
    return { ...this.connectionConfiguration };
  }

  public disconnect = async () => {
    this.incomingCallManager.stop();
    this.sipEventHandler.stop();

    const disconnectedPromise = new Promise<void>((resolve) => {
      this.once(DISCONNECTED, () => {
        resolve();
      });
    });

    const { ua } = this;

    if (ua) {
      ua.stop();
    } else {
      this.uaEvents.trigger(DISCONNECTED, undefined);
    }

    return disconnectedPromise.finally(() => {
      delete this.ua;
    });
  };

  // eslint-disable-next-line class-methods-use-this
  public getSipServerUrl: TGetServerUrl = (id: string) => {
    return id;
  };

  private readonly connectWithDuplicatedCalls: TConnect = async (
    data,
    { callLimit = DELAYED_REPEATED_CALLS_CONNECT_LIMIT } = {},
  ) => {
    const targetFunction = async () => {
      return this.connectInner(data);
    };

    const isComplete = (response?: unknown): boolean => {
      const isConnected = this.ua?.isConnected() === true;
      const isValidResponse = isConnected && this.hasEqualConnectionConfiguration(data);
      const isValidError =
        response !== undefined && response !== null && !hasHandshakeWebsocketOpeningError(response);

      return isValidResponse || isValidError;
    };

    this.isPendingConnect = true;

    this.cancelableConnectWithRepeatedCalls = repeatedCallsAsync<UA>({
      targetFunction,
      isComplete,
      callLimit,
      isRejectAsValid: true,
      isCheckBeforeCall: false,
    });

    return this.cancelableConnectWithRepeatedCalls
      .then((response?: unknown) => {
        if (response instanceof this.JsSIP.UA) {
          return response;
        }

        throw response;
      })
      .finally(() => {
        this.isPendingConnect = false;
      });
  };

  private hasEqualConnectionConfiguration(parameters: TParametersConnection) {
    const { configuration: newConfiguration } = this.uaFactory.createConfiguration(parameters);

    const uaConfiguration = this.ua?.configuration;

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
    if (!sipServerUrl) {
      throw new Error('sipServerUrl is required');
    }

    if (!sipWebSocketServerURL) {
      throw new Error('sipWebSocketServerURL is required');
    }

    if (register && (user === undefined || user === '')) {
      throw new Error('user is required for authorized connection');
    }

    if (register && (password === undefined || password === '')) {
      throw new Error('password is required for authorized connection');
    }

    this.isPendingInitUa = true;

    try {
      this.connectionConfiguration = {
        sipServerUrl,
        displayName,
        register,
        user,
        password,
      };

      const { configuration, helpers } = this.uaFactory.createConfiguration({
        user,
        sipServerUrl,
        sipWebSocketServerURL,
        password,
        displayName,
        register,
        sessionTimers,
        registerExpires,
        connectionRecoveryMinInterval,
        connectionRecoveryMaxInterval,
        userAgent,
      });

      this.getSipServerUrl = helpers.getSipServerUrl;
      this.socket = helpers.socket;

      if (this.ua) {
        await this.disconnect();
      }

      this.ua = this.uaFactory.createUA({ ...configuration, remoteAddress, extraHeaders });

      this.uaEvents.eachTriggers((trigger, eventName) => {
        const uaJsSipEvent = UA_JSSIP_EVENT_NAMES.find((jsSipEvent) => {
          return jsSipEvent === eventName;
        });

        if (uaJsSipEvent && this.ua) {
          this.ua.on(uaJsSipEvent, trigger);
        }
      });

      return this.ua;
    } finally {
      this.isPendingInitUa = false;
    }
  };

  private readonly start: TStart = async () => {
    return new Promise((resolve, reject) => {
      const { ua } = this;

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
        if (this.isRegisterConfig === true) {
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

  private cancelRequests() {
    this.cancelConnectWithRepeatedCalls();
  }

  private cancelConnectWithRepeatedCalls() {
    this.cancelableConnectWithRepeatedCalls?.cancel();
  }
}
