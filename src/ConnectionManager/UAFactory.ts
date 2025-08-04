/* eslint-disable unicorn/filename-case */
import type { TJsSIP } from '@/types';
import { generateUserId, parseDisplayName, resolveSipUrl } from '@/utils/utils';
import type { UA, UAConfigurationParams, WebSocketInterface } from '@krivega/jssip';
import { UA_EVENT_NAMES } from './eventNames';
import getExtraHeadersRemoteAddress from './getExtraHeadersRemoteAddress';

export type TUAConfiguration = {
  configuration: UAConfigurationParams;
  helpers: {
    socket: WebSocketInterface;
    getSipServerUrl: (id: string) => string;
  };
};

export type TCreateUAParameters = UAConfigurationParams & {
  remoteAddress?: string;
  extraHeaders?: string[];
};

type TParametersCreateUaConfiguration = {
  sipWebSocketServerURL: string;
  displayName?: string;
  sipServerUrl: string;
  user?: string;
  register?: boolean;
  password?: string;
  sessionTimers?: boolean;
  registerExpires?: number;
  connectionRecoveryMinInterval?: number;
  connectionRecoveryMaxInterval?: number;
  userAgent?: string;
};

export default class UAFactory {
  private readonly JsSIP: TJsSIP;

  public constructor(JsSIP: TJsSIP) {
    this.JsSIP = JsSIP;
  }

  public static isRegisteredUA(ua?: UA): boolean {
    return !!ua && ua.isRegistered();
  }

  private static validateConfiguration({
    register,
    password,
    user,
    sipServerUrl,
    sipWebSocketServerURL,
  }: {
    register: boolean;
    password?: string;
    user?: string;
    sipServerUrl: string;
    sipWebSocketServerURL: string;
  }): void {
    if (!sipServerUrl) {
      throw new Error('sipServerUrl is required');
    }

    if (!sipWebSocketServerURL) {
      throw new Error('sipWebSocketServerURL is required');
    }

    if (register && (password === undefined || password === '')) {
      throw new Error('password is required for authorized connection');
    }

    if (register && (user === undefined || user === '')) {
      throw new Error('user is required for authorized connection');
    }
  }

  private static resolveAuthorizationUser(register: boolean, user?: string): string {
    return register && user !== undefined && user.trim() !== ''
      ? user.trim()
      : `${generateUserId()}`;
  }

  private static buildExtraHeaders(remoteAddress?: string, extraHeaders?: string[]): string[] {
    const extraHeadersRemoteAddress =
      remoteAddress !== undefined && remoteAddress !== ''
        ? getExtraHeadersRemoteAddress(remoteAddress)
        : [];

    if (extraHeaders === undefined) {
      return extraHeadersRemoteAddress;
    }

    return [...extraHeadersRemoteAddress, ...extraHeaders];
  }

  public createConfiguration({
    user,
    password,
    sipWebSocketServerURL,
    displayName = '',
    sipServerUrl,
    register = false,
    sessionTimers = false,
    registerExpires = 300, // 5 minutes in sec
    connectionRecoveryMinInterval = 2,
    connectionRecoveryMaxInterval = 6,
    userAgent,
  }: TParametersCreateUaConfiguration): TUAConfiguration {
    UAFactory.validateConfiguration({
      register,
      password,
      user,
      sipServerUrl,
      sipWebSocketServerURL,
    });

    const authorizationUser = UAFactory.resolveAuthorizationUser(register, user);
    const getSipServerUrl = resolveSipUrl(sipServerUrl);
    const uri = getSipServerUrl(authorizationUser);
    const socket = new this.JsSIP.WebSocketInterface(sipWebSocketServerURL);

    return {
      configuration: {
        password,
        register,
        uri,
        display_name: parseDisplayName(displayName),
        user_agent: userAgent,
        sdpSemantics: 'unified-plan',
        sockets: [socket],
        session_timers: sessionTimers,
        register_expires: registerExpires,
        connection_recovery_min_interval: connectionRecoveryMinInterval,
        connection_recovery_max_interval: connectionRecoveryMaxInterval,
      },
      helpers: {
        socket,
        getSipServerUrl,
      },
    };
  }

  public createUA({ remoteAddress, extraHeaders, ...parameters }: TCreateUAParameters): UA {
    const ua = new this.JsSIP.UA(parameters);

    const allExtraHeaders = UAFactory.buildExtraHeaders(remoteAddress, extraHeaders);

    if (allExtraHeaders.length > 0) {
      ua.registrator().setExtraHeaders(allExtraHeaders);
    }

    return ua;
  }

  /**
   * Создает UA с полным жизненным циклом - конфигурация + создание + настройка событий
   */
  public createUAWithConfiguration(
    parameters: TParametersCreateUaConfiguration & {
      remoteAddress?: string;
      extraHeaders?: string[];
    },
    events: {
      eachTriggers: (
        callback: (trigger: (...args: unknown[]) => void, eventName: string) => void,
      ) => void;
    },
  ): { ua: UA; helpers: TUAConfiguration['helpers'] } {
    const { configuration, helpers } = this.createConfiguration(parameters);
    const ua = this.createUA({
      ...configuration,
      remoteAddress: parameters.remoteAddress,
      extraHeaders: parameters.extraHeaders,
    });

    events.eachTriggers((trigger, eventName) => {
      const uaJsSipEvent = UA_EVENT_NAMES.find((jsSipEvent) => {
        return jsSipEvent === eventName;
      });

      if (uaJsSipEvent) {
        ua.on(uaJsSipEvent, trigger);
      }
    });

    return { ua, helpers };
  }
}
