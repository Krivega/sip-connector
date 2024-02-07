import type { UA as IUA, IncomingRequest, UAConfiguration } from '@krivega/jssip';
import Events from 'events-constructor';
import type { TEventUA } from '../eventNames';
import { UA_EVENT_NAMES } from '../eventNames';
import Registrator from './Registrator.mock';
import Session from './Session.mock';

export const PASSWORD_CORRECT = 'PASSWORD_CORRECT';
export const PASSWORD_CORRECT_2 = 'PASSWORD_CORRECT_2';
export const NAME_INCORRECT = 'NAME_INCORRECT';

const CONNECTION_DELAY = 400; // more 300 for test cancel requests with debounced

class UA implements IUA {
  private static isAvailableTelephony = true;

  public static setAvailableTelephony() {
    this.isAvailableTelephony = true;
  }

  public static setNotAvailableTelephony() {
    this.isAvailableTelephony = false;
  }

  _events: Events<typeof UA_EVENT_NAMES>;

  _startedTimeout?: ReturnType<typeof setTimeout>;

  _stopedTimeout?: ReturnType<typeof setTimeout>;

  session?: Session;

  _isRegistered?: boolean;

  _isConnected?: boolean;

  configuration: UAConfiguration;

  _registrator: Registrator;

  constructor(configuration: UAConfiguration) {
    this._events = new Events<typeof UA_EVENT_NAMES>(UA_EVENT_NAMES);
    this.configuration = configuration;
    this._registrator = new Registrator();
  }

  /**
   * start
   *
   * @returns {undefined}
   */
  start() {
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
  call = jest.fn((url: string, parameters): Session => {
    const { mediaStream, eventHandlers } = parameters;

    this.session = new Session({ url, mediaStream, eventHandlers, originator: 'local' });

    this.session.connect(url);

    return this.session;
  });

  // @ts-expect-error
  on(eventName: TEventUA, handler) {
    this._events.on(eventName, handler);

    return this;
  }

  // @ts-expect-error
  off(eventName: TEventUA, handler) {
    this._events.off(eventName, handler);

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

    if (register && uri.includes(NAME_INCORRECT)) {
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
