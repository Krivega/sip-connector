import { EEvent } from './events';

import type { UA, URI } from '@krivega/jssip';
import type UAFactory from './UAFactory';

export type TParametersCheckTelephony = {
  displayName: string;
  sipServerIp: string;
  sipServerUrl: string;
  userAgent?: string;
  remoteAddress?: string;
  extraHeaders?: string[];
};

interface IDependencies {
  uaFactory: UAFactory;
  getUaProtected: () => UA;
}

export default class SipOperations {
  private readonly uaFactory: IDependencies['uaFactory'];

  private readonly getUaProtected: IDependencies['getUaProtected'];

  public constructor(dependencies: IDependencies) {
    this.uaFactory = dependencies.uaFactory;
    this.getUaProtected = dependencies.getUaProtected;
  }

  /**
   * Отправляет SIP OPTIONS запрос к указанному адресу
   */
  public async sendOptions(
    target: URI | string,
    body?: string,
    extraHeaders?: string[],
  ): Promise<void> {
    const ua = this.getUaProtected();

    return new Promise((resolve, reject) => {
      try {
        ua.sendOptions(target, body, {
          extraHeaders,
          eventHandlers: {
            succeeded: () => {
              resolve();
            },
            failed: reject,
          },
        });
      } catch (error) {
        reject(error as Error);
      }
    });
  }

  /**
   * Отправляет SIP OPTIONS запрос к собственному URI (ping)
   */
  public async ping(body?: string, extraHeaders?: string[]): Promise<void> {
    const ua = this.getUaProtected();
    const target = ua.configuration.uri;

    return this.sendOptions(target, body, extraHeaders);
  }

  /**
   * Проверяет доступность телефонии, создавая временное соединение
   */
  public async checkTelephony({
    userAgent,
    displayName,
    sipServerIp,
    sipServerUrl,
    remoteAddress,
    extraHeaders,
  }: TParametersCheckTelephony): Promise<void> {
    return new Promise<void>((resolve: () => void, reject: (error: Error) => void) => {
      const { configuration } = this.uaFactory.createConfiguration({
        sipServerUrl,
        displayName,
        userAgent,
        sipServerIp,
      });

      const ua = this.uaFactory.createUA({ ...configuration, remoteAddress, extraHeaders });

      const rejectWithError = () => {
        const error = new Error('Telephony is not available');

        reject(error);
      };

      ua.once(EEvent.DISCONNECTED, rejectWithError);

      const stopAndResolveAfterDisconnect = () => {
        ua.removeAllListeners();
        ua.once(EEvent.DISCONNECTED, () => {
          resolve();
        });
        ua.stop();
      };

      ua.once(EEvent.CONNECTED, stopAndResolveAfterDisconnect);

      ua.start();
    });
  }
}
