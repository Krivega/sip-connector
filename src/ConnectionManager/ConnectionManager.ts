import type { RegisteredEvent, UA, UnRegisteredEvent, WebSocketInterface } from '@krivega/jssip';
import Events from 'events-constructor';
import type { TEventUA } from '../eventNames';
import { UA_EVENT_NAMES } from '../eventNames';
import type { TGetServerUrl, TJsSIP } from '../types';
import ConfigurationManager from './ConfigurationManager';
import type { TConnect } from './ConnectionFlow';
import ConnectionFlow from './ConnectionFlow';
import ConnectionStateMachine from './ConnectionStateMachine';
import IncomingCallManager from './IncomingCallManager';
import RegistrationManager from './RegistrationManager';
import SipEventHandler from './SipEventHandler';
import type { TParametersCheckTelephony } from './SipOperations';
import SipOperations from './SipOperations';
import UAFactory from './UAFactory';

export default class ConnectionManager {
  public ua?: UA;

  public socket?: WebSocketInterface;

  private readonly incomingCallManager: IncomingCallManager;

  private readonly sipEventHandler: SipEventHandler;

  private readonly uaFactory: UAFactory;

  private readonly registrationManager: RegistrationManager;

  private readonly stateMachine: ConnectionStateMachine;

  private readonly connectionFlow: ConnectionFlow;

  private readonly sipOperations: SipOperations;

  private readonly configurationManager: ConfigurationManager;

  private readonly JsSIP: TJsSIP;

  private readonly uaEvents: Events<typeof UA_EVENT_NAMES>;

  public constructor({ JsSIP }: { JsSIP: TJsSIP }) {
    this.JsSIP = JsSIP;

    this.uaEvents = new Events<typeof UA_EVENT_NAMES>(UA_EVENT_NAMES);
    this.incomingCallManager = new IncomingCallManager(this.uaEvents);
    this.sipEventHandler = new SipEventHandler(this.uaEvents);
    this.uaFactory = new UAFactory(JsSIP);
    this.registrationManager = new RegistrationManager({
      uaEvents: this.uaEvents,
      getUa: this.getUa,
    });
    this.stateMachine = new ConnectionStateMachine(this.uaEvents);

    this.configurationManager = new ConfigurationManager({
      getUa: this.getUa,
    });

    this.sipOperations = new SipOperations({
      uaFactory: this.uaFactory,
      getUa: this.getUa,
    });

    this.connectionFlow = new ConnectionFlow({
      JsSIP: this.JsSIP,
      uaEvents: this.uaEvents,
      uaFactory: this.uaFactory,
      stateMachine: this.stateMachine,
      registrationManager: this.registrationManager,
      incomingCallManager: this.incomingCallManager,
      sipEventHandler: this.sipEventHandler,
      getUa: this.getUa,
      getConnectionConfiguration: this.getConnectionConfiguration,
      setConnectionConfiguration: (config) => {
        this.configurationManager.setConnectionConfiguration(config);
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

  public get remoteCallerData() {
    return this.incomingCallManager.remoteCallerData;
  }

  public get isAvailableIncomingCall() {
    return this.incomingCallManager.isAvailableIncomingCall;
  }

  public connect: TConnect = async (data, options) => {
    return this.connectionFlow.connect(data, options);
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
    return this.configurationManager.isConfigured();
  }

  public getConnectionConfiguration = () => {
    return this.configurationManager.getConnectionConfiguration();
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
