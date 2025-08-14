import type { SipConnector } from '@/SipConnector';
import type { IEventHandler, IMainCamHeaders } from './types';

/**
 * Обработчик событий управления главной камерой
 * Отвечает за подписку и отписку от событий SipConnector
 */
export class VideoSendingEventHandler implements IEventHandler {
  private readonly sipConnector: SipConnector;

  private currentHandler?: (headers: IMainCamHeaders) => void;

  public constructor(sipConnector: SipConnector) {
    this.sipConnector = sipConnector;
  }

  /**
   * Подписывается на события управления главной камерой
   * @param handler - Обработчик события
   */
  public subscribe(handler: (headers: IMainCamHeaders) => void): void {
    this.currentHandler = handler;
    this.sipConnector.on('api:main-cam-control', handler);
  }

  /**
   * Отписывается от событий управления главной камерой
   */
  public unsubscribe(): void {
    if (this.currentHandler) {
      this.sipConnector.off('api:main-cam-control', this.currentHandler);
      this.currentHandler = undefined;
    }
  }

  /**
   * Получает соединение из SipConnector
   * @returns RTCPeerConnection или undefined
   */
  public getConnection(): RTCPeerConnection | undefined {
    return this.sipConnector.connection;
  }
}
