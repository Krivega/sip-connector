import type { ApiManager } from '@/ApiManager';
import type {
  IEventHandler,
  IMainCamHeaders,
  TBalancingContext,
  TMainCamControlHandler,
} from './types';

/**
 * Обработчик событий управления главной камерой
 * Отвечает за подписку и отписку от событий apiManager
 */
export class VideoSendingEventHandler implements IEventHandler {
  private readonly apiManager: ApiManager;

  // Ссылка для unsubscribe, которая должна быть та же функция, что была в subscribe
  private currentHandler?: (headers: IMainCamHeaders) => void;

  public constructor(apiManager: ApiManager) {
    this.apiManager = apiManager;
  }

  /**
   * Подписывается на события управления главной камерой
   * @param handler - Обработчик события
   * @param context - Контекст активной сессии балансировки
   */
  public subscribe(handler: TMainCamControlHandler, context: TBalancingContext): void {
    // apiManager передаёт в колбек только headers — дополняем context.
    const wrappedHandler = (headers: IMainCamHeaders) => {
      handler(headers, context);
    };

    this.currentHandler = wrappedHandler;
    this.apiManager.on('main-cam-control', wrappedHandler);
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
