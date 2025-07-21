import type { RegisteredEvent, UA, UnRegisteredEvent, WebSocketInterface } from '@krivega/jssip';
import Events from 'events-constructor';
import type { TGetServerUrl, TJsSIP } from '../types';
import ConfigurationManager from './ConfigurationManager';
import type { TConnect, TSet } from './ConnectionFlow';
import ConnectionFlow from './ConnectionFlow';
import ConnectionStateMachine from './ConnectionStateMachine';
import type { TEvent } from './constants';
import { EVENT_NAMES } from './constants';
import RegistrationManager from './RegistrationManager';
import SipEventHandler from './SipEventHandler';
import type { TParametersCheckTelephony } from './SipOperations';
import SipOperations from './SipOperations';
import UAFactory from './UAFactory';

export default class ConnectionManager {
  public readonly events: Events<typeof EVENT_NAMES>;

  public ua?: UA;

  public socket?: WebSocketInterface;

  private readonly sipEventHandler: SipEventHandler;

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
    this.sipEventHandler = new SipEventHandler(this.events);
    this.uaFactory = new UAFactory(JsSIP);
    this.registrationManager = new RegistrationManager({
      events: this.events,
      getUa: this.getUa,
    });
    this.stateMachine = new ConnectionStateMachine(this.events);

    this.configurationManager = new ConfigurationManager({
      getUa: this.getUa,
    });

    this.sipOperations = new SipOperations({
      uaFactory: this.uaFactory,
      getUa: this.getUa,
    });

    this.connectionFlow = new ConnectionFlow({
      JsSIP: this.JsSIP,
      events: this.events,
      uaFactory: this.uaFactory,
      stateMachine: this.stateMachine,
      registrationManager: this.registrationManager,
      sipEventHandler: this.sipEventHandler,
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

  public get connectionState() {
    return this.stateMachine.state;
  }

  public get isRegistered() {
    return UAFactory.isRegisteredUA(this.ua);
  }

  public get isRegisterConfig() {
    return this.configurationManager.isRegister();
  }

  public connect: TConnect = async (data, options) => {
    return this.connectionFlow.connect(data, options);
  };

  public set: TSet = async ({ displayName }) => {
    return this.connectionFlow.set({ displayName });
  };

  public disconnect = async () => {
    return this.connectionFlow.disconnect();
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

  // eslint-disable-next-line class-methods-use-this
  public getSipServerUrl: TGetServerUrl = (id: string) => {
    return id;
  };

  private readonly getUa = () => {
    return this.ua;
  };
}
