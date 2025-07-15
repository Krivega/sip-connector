import type {
  UA as IUA,
  IncomingRequest,
  UAConfiguration,
  UAConfigurationParams,
} from '@krivega/jssip';
import { URI } from '@krivega/jssip';
import Events from 'events-constructor';
import type { TEventUA } from '../eventNames';
import { UA_EVENT_NAMES } from '../eventNames';
import Registrator from './Registrator.mock';
import RTCSessionMock from './RTCSessionMock';

export const PASSWORD_CORRECT = 'PASSWORD_CORRECT';
export const PASSWORD_CORRECT_2 = 'PASSWORD_CORRECT_2';
export const NAME_INCORRECT = 'NAME_INCORRECT';

export const createWebsocketHandshakeTimeoutError = (sipServerUrl: string) => {
  return {
    socket: {
      _url: `wss://${sipServerUrl}/webrtc/wss/`,
      _sip_uri: `sip:${sipServerUrl};transport=ws`,
      _via_transport: 'WSS',
      _ws: null,
    },
    error: true,
    code: 1006,
    reason: '',
  };
};

const CONNECTION_DELAY = 400; // more 300 for test cancel requests with debounced

class UA implements IUA {
  private static isAvailableTelephony = true;

  private static startError?: unknown;

  private static countStartError: number = Number.POSITIVE_INFINITY;

  private static countStarts = 0;

  public static setStartError(
    startError: unknown,
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

  events: Events<typeof UA_EVENT_NAMES>;

  private startedTimeout?: ReturnType<typeof setTimeout>;

  private stopedTimeout?: ReturnType<typeof setTimeout>;

  private session?: RTCSessionMock;

  private isRegisteredInner?: boolean;

  private isConnectedInner?: boolean;

  private configuration: UAConfiguration;

  public readonly registratorInner: Registrator;

  constructor(_configuration: UAConfigurationParams) {
    this.events = new Events<typeof UA_EVENT_NAMES>(UA_EVENT_NAMES);

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
        this.trigger('disconnected', { error: new Error('stoped') });
      }, CONNECTION_DELAY);
    } else {
      this.trigger('disconnected', { error: new Error('stoped') });
    }
  }

  // @ts-expect-error
  call = jest.fn((url: string, parameters): RTCSessionMock => {
    const { mediaStream, eventHandlers } = parameters;

    this.session = new RTCSessionMock({ url, mediaStream, eventHandlers, originator: 'local' });

    this.session.connect(url);

    return this.session;
  });

  // @ts-expect-error
  on(eventName: TEventUA, handler) {
    this.events.on(eventName, handler);

    return this;
  }

  // @ts-expect-error
  once(eventName: TEventUA, handler) {
    this.events.once(eventName, handler);

    return this;
  }

  // @ts-expect-error
  off(eventName: TEventUA, handler) {
    this.events.off(eventName, handler);

    return this;
  }

  removeAllListeners() {
    this.events.removeEventHandlers();

    return this;
  }

  trigger(eventName: TEventUA, data?: any) {
    this.events.trigger(eventName, data);
  }

  /**
   * terminateSessions
   *
   * @returns {undefined}
   */
  terminateSessions() {
    this.session!.terminate();
  }

  /**
   * set
   *
   * @param {string} key   - key
   * @param {string} value - value
   *
   * @returns {boolean} true
   */
  set(key: string, value: any) {
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
        this.trigger('registrationFailed', { response: null, cause: 'Request Timeout' });
      }, CONNECTION_DELAY);
    } else if (
      !this.isRegistered() &&
      register &&
      (password === PASSWORD_CORRECT || password === PASSWORD_CORRECT_2)
    ) {
      this.isRegisteredInner = true;
      this.startedTimeout = setTimeout(() => {
        this.trigger('registered');
      }, CONNECTION_DELAY);
    } else if (register && password !== PASSWORD_CORRECT && password !== PASSWORD_CORRECT_2) {
      this.isRegisteredInner = false;
      this.isConnectedInner = false;
      this.startedTimeout = setTimeout(() => {
        this.trigger('registrationFailed', { response: null, cause: 'Wrong credentials' });
      }, CONNECTION_DELAY);
    }

    if (UA.isAvailableTelephony) {
      this.trigger('connected');
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

    this.trigger('unregistered');
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
      this.configuration &&
      ((this.configuration.register && !!this.isRegisteredInner) ||
        (!this.configuration.register && !!this.isConnectedInner))
    );
  }

  newSipEvent(data: { request: IncomingRequest }) {
    this.trigger('sipEvent', data);
  }

  registrator() {
    return this.registratorInner;
  }
}

export default UA;
