import type {
  DisconnectEvent,
  UA as IUA,
  IncomingRequest,
  IncomingResponse,
  Socket,
  UAConfiguration,
  UAConfigurationParams,
  UAEventMap,
} from '@krivega/jssip';
import { C, URI } from '@krivega/jssip';
import Events from 'events-constructor';
import { UA_JSSIP_EVENT_NAMES } from '../eventNames';
import type { TEventHandlers } from './BaseSession.mock';
import Registrator from './Registrator.mock';
import RTCSessionMock from './RTCSessionMock';

export const PASSWORD_CORRECT = 'PASSWORD_CORRECT';
export const PASSWORD_CORRECT_2 = 'PASSWORD_CORRECT_2';
export const NAME_INCORRECT = 'NAME_INCORRECT';

export const createWebsocketHandshakeTimeoutError = (sipServerUrl: string): DisconnectEvent => {
  return {
    socket: {
      url: `wss://${sipServerUrl}/webrtc/wss/`,
      sip_uri: `sip:${sipServerUrl};transport=ws`,
      via_transport: 'WSS',
    } as unknown as Socket,
    error: true,
    code: 1006,
    reason: '',
  };
};

const CONNECTION_DELAY = 400; // more 300 for test cancel requests with debounced

const socket = {
  url: 'wss://sipServerUrl/webrtc/wss/',
  sip_uri: 'sip:sipServerUrl;transport=ws',
  via_transport: 'WSS',
} as unknown as Socket;

const responseSuccess = {
  status_code: 200,
  reason_phrase: 'OK',
} as unknown as IncomingResponse;
const responseFailed = {
  status_code: 401,
  reason_phrase: 'Unauthorized',
} as unknown as IncomingResponse;

class UA implements IUA {
  private static isAvailableTelephony = true;

  private static startError?: DisconnectEvent;

  private static countStartError: number = Number.POSITIVE_INFINITY;

  private static countStarts = 0;

  public static setStartError(
    startError: DisconnectEvent,
    { count = Number.POSITIVE_INFINITY }: { count?: number } = {},
  ) {
    this.startError = startError;
    this.countStartError = count;
  }

  public static resetStartError() {
    this.startError = undefined;
    this.countStartError = Number.POSITIVE_INFINITY;
    this.countStarts = 0;
  }

  public static setAvailableTelephony() {
    this.isAvailableTelephony = true;
  }

  public static setNotAvailableTelephony() {
    this.isAvailableTelephony = false;
  }

  events: Events<readonly (keyof UAEventMap)[]>;

  private startedTimeout?: ReturnType<typeof setTimeout>;

  private stopedTimeout?: ReturnType<typeof setTimeout>;

  private session?: RTCSessionMock;

  private isRegisteredInner?: boolean;

  private isConnectedInner?: boolean;

  private configuration: UAConfiguration;

  public readonly registratorInner: Registrator;

  constructor(_configuration: UAConfigurationParams) {
    this.events = new Events<readonly (keyof UAEventMap)[]>(UA_JSSIP_EVENT_NAMES);

    const [scheme, infoUri] = _configuration.uri.split(':');
    const [user, url] = infoUri.split('@');

    const configuration = {
      ..._configuration,
      uri: new URI(scheme, user, url),
    };

    this.configuration = configuration;
    this.registratorInner = new Registrator();
  }

  /**
   * start
   *
   * @returns {undefined}
   */
  start() {
    UA.countStarts += 1;

    if (UA.startError && UA.countStarts < UA.countStartError) {
      this.trigger('disconnected', UA.startError);

      return;
    }

    this.register();
  }

  /**
   * stop
   *
   * @returns {undefined}
   */
  stop() {
    if (this.startedTimeout) {
      clearTimeout(this.startedTimeout);
    }

    if (this.stopedTimeout) {
      clearTimeout(this.stopedTimeout);
    }

    this.unregister();

    if (this.isStarted()) {
      this.stopedTimeout = setTimeout(() => {
        this.trigger('disconnected', { error: true, socket });
      }, CONNECTION_DELAY);
    } else {
      this.trigger('disconnected', { error: true, socket });
    }
  }

  // @ts-expect-error
  call = jest.fn(
    (
      url: string,
      parameters: { mediaStream: MediaStream; eventHandlers: TEventHandlers },
    ): RTCSessionMock => {
      const { mediaStream, eventHandlers } = parameters;

      this.session = new RTCSessionMock({ url, mediaStream, eventHandlers, originator: 'local' });

      this.session.connect(url);

      return this.session;
    },
  );

  on<T extends keyof UAEventMap>(eventName: T, handler: UAEventMap[T]) {
    // @ts-expect-error
    this.events.on<Parameters<UAEventMap[T]>[0]>(eventName, handler);

    return this;
  }

  once<T extends keyof UAEventMap>(eventName: T, handler: UAEventMap[T]) {
    // @ts-expect-error
    this.events.once<Parameters<UAEventMap[T]>[0]>(eventName, handler);

    return this;
  }

  off<T extends keyof UAEventMap>(eventName: T, handler: UAEventMap[T]) {
    // @ts-expect-error
    this.events.off<Parameters<UAEventMap[T]>[0]>(eventName, handler);

    return this;
  }

  removeAllListeners() {
    this.events.removeEventHandlers();

    return this;
  }

  trigger<T extends keyof UAEventMap>(eventName: T, data: Parameters<UAEventMap[T]>[0]) {
    this.events.trigger(eventName, data);
  }

  /**
   * terminateSessions
   *
   * @returns {undefined}
   */
  terminateSessions() {
    this.session?.terminate();
  }

  set(key: keyof UAConfiguration, value: UAConfiguration[keyof UAConfiguration]) {
    // @ts-expect-error
    this.configuration[key] = value;

    return true;
  }

  /**
   * register
   *
   * @returns {undefined}
   */
  register() {
    if (this.startedTimeout) {
      clearTimeout(this.startedTimeout);
    }

    const { password, register, uri } = this.configuration;

    if (register && uri.user.includes(NAME_INCORRECT)) {
      this.isRegisteredInner = false;
      this.isConnectedInner = false;
      this.startedTimeout = setTimeout(() => {
        this.trigger('registrationFailed', { response: responseFailed, cause: C.causes.REJECTED });
      }, CONNECTION_DELAY);
    } else if (
      !this.isRegistered() &&
      register &&
      (password === PASSWORD_CORRECT || password === PASSWORD_CORRECT_2)
    ) {
      this.isRegisteredInner = true;
      this.startedTimeout = setTimeout(() => {
        this.trigger('registered', { response: responseSuccess });
      }, CONNECTION_DELAY);
    } else if (register && password !== PASSWORD_CORRECT && password !== PASSWORD_CORRECT_2) {
      this.isRegisteredInner = false;
      this.isConnectedInner = false;
      this.startedTimeout = setTimeout(() => {
        this.trigger('registrationFailed', { response: responseFailed, cause: C.causes.REJECTED });
      }, CONNECTION_DELAY);
    }

    if (UA.isAvailableTelephony) {
      this.trigger('connected', { socket });
      this.isConnectedInner = true;
    } else {
      this.stop();
    }
  }

  /**
   * unregister
   *
   * @returns {undefined}
   */
  unregister() {
    this.isRegisteredInner = false;
    this.isConnectedInner = false;

    this.trigger('unregistered', { response: responseSuccess });
  }

  isRegistered() {
    return !!this.isRegisteredInner;
  }

  isConnected() {
    return !!this.isConnectedInner;
  }

  /**
   * isStarted
   *
   * @returns {boolean} isStarted
   */
  isStarted() {
    return (
      (this.configuration.register && !!this.isRegisteredInner) ??
      (!this.configuration.register && !!this.isConnectedInner)
    );
  }

  newSipEvent(data: { event: unknown; request: IncomingRequest }) {
    this.trigger('sipEvent', data);
  }

  registrator() {
    return this.registratorInner;
  }
}

export default UA;
