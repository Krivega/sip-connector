import { Events } from 'events-constructor';

import logger from '@/logger';
import ConfigurationManager from './ConfigurationManager';
import ConnectionFlow from './ConnectionFlow';
import ConnectionStateMachine from './ConnectionStateMachine';
import { EEvent, EVENT_NAMES } from './eventNames';
import RegistrationManager from './RegistrationManager';
import SipOperations from './SipOperations';
import UAFactory from './UAFactory';
import { createNotReadyForConnectionError, resolveParameters } from './utils';

import type { RegisteredEvent, UA, UnRegisteredEvent, WebSocketInterface } from '@krivega/jssip';
import type { TGetServerUrl } from '@/CallManager';
import type { TJsSIP } from '@/types';
import type { TConnect, TSet } from './ConnectionFlow';
import type { TEvent } from './eventNames';
import type { TParametersCheckTelephony } from './SipOperations';

type TConnectParameters = (() => Promise<Parameters<TConnect>[0]>) | Parameters<TConnect>[0];
type TConnectOptions = Parameters<TConnect>[1] & {
  hasReadyForConnection?: () => boolean;
};

export default class ConnectionManager {
  public readonly events: Events<typeof EVENT_NAMES>;

  public ua?: UA;

  public socket?: WebSocketInterface;

  private readonly uaFactory: UAFactory;

  private readonly registrationManager: RegistrationManager;

  private readonly stateMachine: ConnectionStateMachine;

  private readonly connectionFlow: ConnectionFlow;

  private readonly sipOperations: SipOperations;

  private readonly configurationManager: ConfigurationManager;

  private readonly JsSIP: TJsSIP;

  public constructor({ JsSIP }: { JsSIP: TJsSIP }) {
    this.JsSIP = JsSIP;

    this.events = new Events<typeof EVENT_NAMES>(EVENT_NAMES);
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
      JsSIP: this.JsSIP,
      events: this.events,
      uaFactory: this.uaFactory,
      stateMachine: this.stateMachine,
      registrationManager: this.registrationManager,
      getUa: this.getUa,
      getConnectionConfiguration: this.getConnectionConfiguration,
      setConnectionConfiguration: (config) => {
        this.configurationManager.set(config);
      },
      updateConnectionConfiguration: (key: 'displayName', value: string) => {
        this.configurationManager.update(key, value);
      },
      setUa: (ua: UA | undefined) => {
        this.ua = ua;
      },
      setSipServerUrl: (getSipServerUrl: TGetServerUrl) => {
        this.getSipServerUrl = getSipServerUrl;
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
  ): Promise<UA> => {
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

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public on<T>(eventName: TEvent, handler: (data: T) => void) {
    return this.events.on<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public once<T>(eventName: TEvent, handler: (data: T) => void) {
    return this.events.once<T>(eventName, handler);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public onceRace<T>(eventNames: TEvent[], handler: (data: T, eventName: string) => void) {
    return this.events.onceRace<T>(eventNames, handler);
  }

  public async wait<T>(eventName: TEvent): Promise<T> {
    return this.events.wait<T>(eventName);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public off<T>(eventName: TEvent, handler: (data: T) => void) {
    this.events.off<T>(eventName, handler);
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
  public getSipServerUrl: TGetServerUrl = (id: string) => {
    return id;
  };

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
      .then(async (data) => {
        return this.connectionFlow.connect(data, options);
      })
      .then((ua) => {
        this.events.trigger(EEvent.CONNECT_SUCCEEDED, { ua });

        return ua;
      })
      .catch((error: unknown) => {
        const connectError: unknown = error ?? new Error('Failed to connect to server');

        this.events.trigger(EEvent.CONNECT_FAILED, connectError);

        throw connectError;
      });
  };
}
