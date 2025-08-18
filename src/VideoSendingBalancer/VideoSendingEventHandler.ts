import type { ApiManager } from '@/ApiManager';
import type { IEventHandler, IMainCamHeaders } from './types';

/**
 * Обработчик событий управления главной камерой
 * Отвечает за подписку и отписку от событий apiManager
 */
export class VideoSendingEventHandler implements IEventHandler {
  private readonly apiManager: ApiManager;

  private currentHandler?: (headers: IMainCamHeaders) => void;

  public constructor(apiManager: ApiManager) {
    this.apiManager = apiManager;
  }

  /**
   * Подписывается на события управления главной камерой
   * @param handler - Обработчик события
   */
  public subscribe(handler: (headers: IMainCamHeaders) => void): void {
    this.currentHandler = handler;
    this.apiManager.on('main-cam-control', handler);
  }

  /**
   * Отписывается от событий управления главной камерой
   */
  public unsubscribe(): void {
    if (this.currentHandler) {
      this.apiManager.off('main-cam-control', this.currentHandler);
      this.currentHandler = undefined;
    }
  }
}
