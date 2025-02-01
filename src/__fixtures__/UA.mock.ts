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

  _events: Events<typeof UA_EVENT_NAMES>;

  _startedTimeout?: ReturnType<typeof setTimeout>;

  _stopedTimeout?: ReturnType<typeof setTimeout>;

  session?: RTCSessionMock;

  _isRegistered?: boolean;

  _isConnected?: boolean;

  configuration: UAConfiguration;

  _registrator: Registrator;

  constructor(_configuration: UAConfigurationParams) {
    this._events = new Events<typeof UA_EVENT_NAMES>(UA_EVENT_NAMES);

    const [scheme, infoUri] = _configuration.uri.split(':');
    const [user, url] = infoUri.split('@');

    const configuration = {
      ..._configuration,
      uri: new URI(scheme, user, url),
    };

    this.configuration = configuration;
    this._registrator = new Registrator();
  }

  isConnected() {
    return !!this._isConnected;
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
    if (this._startedTimeout) {
      clearTimeout(this._startedTimeout);
    }

    if (this._stopedTimeout) {
      clearTimeout(this._stopedTimeout);
    }

    this.unregister();

    if (this.isStarted()) {
      this._stopedTimeout = setTimeout(() => {
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
    this._events.on(eventName, handler);

    return this;
  }

  // @ts-expect-error
  once(eventName: TEventUA, handler) {
    this._events.once(eventName, handler);

    return this;
  }

  // @ts-expect-error
  off(eventName: TEventUA, handler) {
    this._events.off(eventName, handler);

    return this;
  }

  removeAllListeners() {
    this._events.removeEventHandlers();

    return this;
  }

  trigger(eventName: TEventUA, data?: any) {
    this._events.trigger(eventName, data);
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
    if (this._startedTimeout) {
      clearTimeout(this._startedTimeout);
    }

    const { password, register, uri } = this.configuration;

    if (register && uri.user.includes(NAME_INCORRECT)) {
      this._isRegistered = false;
      this._isConnected = false;
      this._startedTimeout = setTimeout(() => {
        this.trigger('registrationFailed', { response: null, cause: 'Request Timeout' });
      }, CONNECTION_DELAY);
    } else if (
      !this._isRegistered &&
      register &&
      (password === PASSWORD_CORRECT || password === PASSWORD_CORRECT_2)
    ) {
      this._isRegistered = true;
      this._startedTimeout = setTimeout(() => {
        this.trigger('registered');
      }, CONNECTION_DELAY);
    } else if (register && password !== PASSWORD_CORRECT && password !== PASSWORD_CORRECT_2) {
      this._isRegistered = false;
      this._isConnected = false;
      this._startedTimeout = setTimeout(() => {
        this.trigger('registrationFailed', { response: null, cause: 'Wrong credentials' });
      }, CONNECTION_DELAY);
    }

    if (UA.isAvailableTelephony) {
      this.trigger('connected');
      this._isConnected = true;
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
    this._isRegistered = false;
    this._isConnected = false;

    this.trigger('unregistered');
  }

  /**
   * isRegistered
   *
   * @returns {boolean} isRegistered
   */
  isRegistered() {
    return !!this._isRegistered;
  }

  /**
   * isStarted
   *
   * @returns {boolean} isStarted
   */
  isStarted() {
    return (
      this.configuration &&
      ((this.configuration.register && !!this._isRegistered) ||
        (!this.configuration.register && !!this._isConnected))
    );
  }

  registrator() {
    return this._registrator;
  }

  newSipEvent(data: { request: IncomingRequest }) {
    this.trigger('sipEvent', data);
  }
}

export default UA;
