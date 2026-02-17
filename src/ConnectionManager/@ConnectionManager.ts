import logger from '@/logger';
import ConfigurationManager from './ConfigurationManager';
import ConnectionFlow from './ConnectionFlow';
import { ConnectionStateMachine } from './ConnectionStateMachine';
import { createEvents, EEvent } from './events';
import RegistrationManager from './RegistrationManager';
import SipOperations from './SipOperations';
import UAFactory from './UAFactory';
import { createNotReadyForConnectionError, resolveParameters } from './utils';

import type { RegisteredEvent, UA, UnRegisteredEvent, WebSocketInterface } from '@krivega/jssip';
import type { TGetUri } from '@/CallManager';
import type { TJsSIP } from '@/types';
import type { TConnectionConfiguration } from './ConfigurationManager';
import type { TConnect, TParametersConnection, TSet } from './ConnectionFlow';
import type { TEventMap, TEvents } from './events';
import type { TParametersCheckTelephony } from './SipOperations';

type TConnectParameters = (() => Promise<TParametersConnection>) | TParametersConnection;
type TConnectOptions = Parameters<TConnect>[1] & {
  hasReadyForConnection?: () => boolean;
};

export default class ConnectionManager {
  public readonly events: TEvents;

  public readonly stateMachine: ConnectionStateMachine;

  public ua?: UA;

  public socket?: WebSocketInterface;

  private readonly uaFactory: UAFactory;

  private readonly registrationManager: RegistrationManager;

  private readonly connectionFlow: ConnectionFlow;

  private readonly sipOperations: SipOperations;

  private readonly configurationManager: ConfigurationManager;

  public constructor({ JsSIP }: { JsSIP: TJsSIP }) {
    this.events = createEvents();
    this.uaFactory = new UAFactory(JsSIP);
    this.registrationManager = new RegistrationManager({
      events: this.events,
      getUaProtected: this.getUaProtected,
    });
    this.stateMachine = new ConnectionStateMachine(this.events);

    this.configurationManager = new ConfigurationManager({
      getUa: this.getUa,
    });

    this.sipOperations = new SipOperations({
      uaFactory: this.uaFactory,
      getUaProtected: this.getUaProtected,
    });

    this.connectionFlow = new ConnectionFlow({
      events: this.events,
      uaFactory: this.uaFactory,
      stateMachine: this.stateMachine,
      registrationManager: this.registrationManager,
      getUa: this.getUa,
      getConnectionConfiguration: this.getConnectionConfiguration,
      setConnectionConfiguration: (config) => {
        this.configurationManager.set(config);
      },
      updateConnectionConfiguration: <K extends keyof TConnectionConfiguration>(
        key: K,
        value: TConnectionConfiguration[K],
      ) => {
        this.configurationManager.update(key, value);
      },
      setUa: (ua: UA | undefined) => {
        this.ua = ua;
      },
      setGetUri: (getUri: TGetUri) => {
        this.getUri = getUri;
      },
      setSocket: (socket: WebSocketInterface) => {
        this.socket = socket;
      },
    });
  }

  public get requested() {
    return this.stateMachine.isPending;
  }

  public get isPendingConnect() {
    return this.stateMachine.isPendingConnect;
  }

  public get isPendingInitUa() {
    return this.stateMachine.isPendingInitUa;
  }

  public get isIdle() {
    return this.stateMachine.isIdle;
  }

  public get isDisconnected() {
    return this.stateMachine.isDisconnected;
  }

  public get isFailed() {
    return this.stateMachine.isFailed;
  }

  public get connectionState() {
    return this.stateMachine.state;
  }

  public get isRegistered() {
    return UAFactory.isRegisteredUA(this.ua);
  }

  public get isRegisterConfig() {
    return this.configurationManager.isRegister();
  }

  public connect = async (
    parameters: TConnectParameters,
    options?: TConnectOptions,
  ): Promise<TConnectionConfiguration> => {
    return this.disconnect()
      .catch((error: unknown) => {
        logger('connect: disconnect error', error);
      })
      .then(async () => {
        return this.connectWithProcessError(parameters, options);
      });
  };

  public set: TSet = async ({ displayName }) => {
    return this.connectionFlow.set({ displayName });
  };

  public disconnect = async () => {
    if (this.isConfigured()) {
      return this.connectionFlow.disconnect();
    }

    return undefined;
  };

  public async register(): Promise<RegisteredEvent> {
    return this.registrationManager.register();
  }

  public async unregister(): Promise<UnRegisteredEvent> {
    return this.registrationManager.unregister();
  }

  public readonly tryRegister = async () => {
    return this.registrationManager.tryRegister();
  };

  public sendOptions = async (
    target: Parameters<SipOperations['sendOptions']>[0],
    body?: Parameters<SipOperations['sendOptions']>[1],
    extraHeaders?: Parameters<SipOperations['sendOptions']>[2],
  ) => {
    return this.sipOperations.sendOptions(target, body, extraHeaders);
  };

  public ping = async (
    body?: Parameters<SipOperations['ping']>[0],
    extraHeaders?: Parameters<SipOperations['ping']>[1],
  ) => {
    return this.sipOperations.ping(body, extraHeaders);
  };

  public checkTelephony = async (parameters: TParametersCheckTelephony) => {
    return this.sipOperations.checkTelephony(parameters);
  };

  public on<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.events.on(eventName, handler);
  }

  public once<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.events.once(eventName, handler);
  }

  public onceRace<T extends keyof TEventMap>(
    eventNames: T[],
    handler: (data: TEventMap[T], eventName: string) => void,
  ) {
    return this.events.onceRace(eventNames, handler);
  }

  public async wait<T extends keyof TEventMap>(eventName: T): Promise<TEventMap[T]> {
    return this.events.wait(eventName);
  }

  public off<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    this.events.off(eventName, handler);
  }

  public isConfigured() {
    return this.configurationManager.isConfigured();
  }

  public getConnectionConfiguration = () => {
    return this.configurationManager.get();
  };

  public destroy(): void {
    this.stateMachine.destroy();
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public getUri: TGetUri = (id: string) => {
    return id;
  };

  public getUser(): string | undefined {
    try {
      const ua = this.getUaProtected();

      return ua.configuration.uri.user;
    } catch {
      return undefined;
    }
  }

  public readonly getUaProtected = () => {
    if (!this.ua) {
      throw new Error('UA not initialized');
    }

    return this.ua;
  };

  private readonly getUa = () => {
    return this.ua;
  };

  private readonly connectWithProcessError = async (
    parameters: TConnectParameters,
    options?: TConnectOptions,
  ) => {
    const isReadyForConnection = options?.hasReadyForConnection?.() ?? true;

    if (!isReadyForConnection) {
      throw createNotReadyForConnectionError();
    }

    return this.processConnect(parameters, options).catch(async (error: unknown) => {
      const typedError = error as Error;

      return this.disconnect()
        .then(() => {
          throw typedError;
        })
        .catch(() => {
          throw typedError;
        });
    });
  };

  private readonly processConnect = async (
    parameters: TConnectParameters,
    options?: TConnectOptions,
  ) => {
    this.events.trigger(EEvent.CONNECT_STARTED, {});

    return resolveParameters(parameters)
      .then((data) => {
        this.events.trigger(EEvent.CONNECT_PARAMETERS_RESOLVE_SUCCESS, data);

        return data;
      })
      .catch((error: unknown) => {
        this.events.trigger(EEvent.CONNECT_PARAMETERS_RESOLVE_FAILED, error);

        throw error;
      })
      .then(async (data) => {
        return this.connectionFlow.connect(data, options);
      })
      .then((connectionConfigurationWithUa) => {
        this.events.trigger(EEvent.CONNECT_SUCCEEDED, {
          ...connectionConfigurationWithUa,
        });

        return connectionConfigurationWithUa;
      })
      .catch((error: unknown) => {
        const connectError: unknown = error ?? new Error('Failed to connect to server');

        this.events.trigger(EEvent.CONNECT_FAILED, connectError);

        throw connectError;
      });
  };
}
