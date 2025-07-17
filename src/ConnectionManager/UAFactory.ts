/* eslint-disable unicorn/filename-case */
import type { UA, UAConfigurationParams, WebSocketInterface } from '@krivega/jssip';
import { generateUserId, parseDisplayName, resolveSipUrl } from '../../utils';
import getExtraHeadersRemoteAddress from '../getExtraHeadersRemoteAddress';
import type { TJsSIP, TParametersCreateUaConfiguration } from '../types';

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
  }: {
    register: boolean;
    password?: string;
    user?: string;
  }): void {
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

  private static buildExtraHeaders(remoteAddress?: string, extraHeaders: string[] = []): string[] {
    const extraHeadersRemoteAddress =
      remoteAddress !== undefined && remoteAddress !== ''
        ? getExtraHeadersRemoteAddress(remoteAddress)
        : [];

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
    UAFactory.validateConfiguration({ register, password, user });

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

  public createUA({ remoteAddress, extraHeaders = [], ...parameters }: TCreateUAParameters): UA {
    const ua = new this.JsSIP.UA(parameters);

    const allExtraHeaders = UAFactory.buildExtraHeaders(remoteAddress, extraHeaders);

    if (allExtraHeaders.length > 0) {
      ua.registrator().setExtraHeaders(allExtraHeaders);
    }

    return ua;
  }
}
