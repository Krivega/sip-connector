/* eslint-disable unicorn/filename-case */
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

  public events: Events<readonly (keyof UAEventMap)[]>;

  public readonly registratorInner!: Registrator;

  // @ts-expect-error – Jest создаёт функцию-замок.
  public call = jest.fn(
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

  public sendOptions = jest.fn(
    (target: string, body?: string, options?: Record<string, unknown>) => {
      // eslint-disable-next-line no-console
      console.log('sendOptions', target, body, options);
    },
  );

  /**
   * start – имитирует запуск UA.
   */
  public start = jest.fn(() => {
    UA.countStarts += 1;

    if (UA.startError && UA.countStarts < UA.countStartError) {
      this.trigger('disconnected', UA.startError);

      return;
    }

    this.register();
  });

  /**
   * stop – имитирует остановку UA.
   */
  public stop = jest.fn(() => {
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
  });

  public removeAllListeners = jest.fn(() => {
    this.events.removeEventHandlers();

    return this;
  });

  public once = jest.fn((eventName: string, handler: () => void) => {
    // @ts-expect-error
    this.events.once(eventName, handler);

    return this;
  });

  private startedTimeout?: ReturnType<typeof setTimeout>;

  private stopedTimeout?: ReturnType<typeof setTimeout>;

  private session?: RTCSessionMock;

  private isRegisteredInner?: boolean;

  private isConnectedInner?: boolean;

  private configuration: UAConfiguration;

  public constructor(_configuration: UAConfigurationParams) {
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

  public static setStartError(
    startError: DisconnectEvent,
    { count = Number.POSITIVE_INFINITY }: { count?: number } = {},
  ) {
    UA.startError = startError;
    UA.countStartError = count;
  }

  public static resetStartError() {
    UA.startError = undefined;
    UA.countStartError = Number.POSITIVE_INFINITY;
    UA.countStarts = 0;
  }

  public static setAvailableTelephony() {
    UA.isAvailableTelephony = true;
  }

  public static setNotAvailableTelephony() {
    UA.isAvailableTelephony = false;
  }

  public static reset() {
    UA.resetStartError();
    UA.setAvailableTelephony();
  }

  public on<T extends keyof UAEventMap>(eventName: T, handler: UAEventMap[T]) {
    // @ts-expect-error
    this.events.on<Parameters<UAEventMap[T]>[0]>(eventName, handler);

    return this;
  }

  public off<T extends keyof UAEventMap>(eventName: T, handler: UAEventMap[T]) {
    // @ts-expect-error
    this.events.off<Parameters<UAEventMap[T]>[0]>(eventName, handler);

    return this;
  }

  public trigger<T extends keyof UAEventMap>(eventName: T, data: Parameters<UAEventMap[T]>[0]) {
    this.events.trigger(eventName, data);
  }

  /**
   * terminateSessions
   *
   * @returns {undefined}
   */
  public terminateSessions() {
    this.session?.terminate();
  }

  public set(key: keyof UAConfiguration, value: UAConfiguration[keyof UAConfiguration]) {
    // @ts-expect-error
    this.configuration[key] = value;

    return true;
  }

  /**
   * register
   *
   * @returns {undefined}
   */
  public register() {
    if (this.startedTimeout) {
      clearTimeout(this.startedTimeout);
    }

    const { password, register, uri } = this.configuration;

    if (register === true && uri.user.includes(NAME_INCORRECT)) {
      this.isRegisteredInner = false;
      this.isConnectedInner = false;
      this.startedTimeout = setTimeout(() => {
        this.trigger('registrationFailed', { response: responseFailed, cause: C.causes.REJECTED });
      }, CONNECTION_DELAY);
    } else if (
      !this.isRegistered() &&
      register === true &&
      (password === PASSWORD_CORRECT || password === PASSWORD_CORRECT_2)
    ) {
      this.isRegisteredInner = true;
      this.startedTimeout = setTimeout(() => {
        this.trigger('registered', { response: responseSuccess });
      }, CONNECTION_DELAY);
    } else if (
      register === true &&
      password !== PASSWORD_CORRECT &&
      password !== PASSWORD_CORRECT_2
    ) {
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
  public unregister() {
    this.isRegisteredInner = false;
    this.isConnectedInner = false;

    this.trigger('unregistered', { response: responseSuccess });
  }

  public isRegistered() {
    return this.isRegisteredInner === true;
  }

  public isConnected() {
    return this.isConnectedInner === true;
  }

  /**
   * isStarted
   *
   * @returns {boolean} isStarted
   */
  public isStarted() {
    return (
      (this.configuration.register === true && this.isRegisteredInner === true) ||
      (this.configuration.register !== true && this.isConnectedInner === true)
    );
  }

  public newSipEvent(data: { event: unknown; request: IncomingRequest }) {
    this.trigger('sipEvent', data);
  }

  public registrator() {
    return this.registratorInner;
  }
}

export default UA;
