import debug from '@/logger';
import { CodecProvider } from './CodecProvider';
import { ParametersSetterWithQueue } from './ParametersSetterWithQueue';
import { SenderBalancer } from './SenderBalancer';
import { SenderFinder } from './SenderFinder';
import { VideoSendingEventHandler } from './VideoSendingEventHandler';

import type { ApiManager } from '@/ApiManager';
import type { TResultSetParametersToSender } from '@/tools';
import type { IBalancerOptions, IMainCamHeaders } from './types';

/**
 * Контроллер/фасад для балансировки видеопотоков
 * Координирует работу обработчика событий, балансировщика и очереди задач
 */
class VideoSendingBalancer {
  private readonly eventHandler: VideoSendingEventHandler;

  private readonly senderBalancer: SenderBalancer;

  private readonly parametersSetterWithQueue: ParametersSetterWithQueue;

  private readonly getConnection: () => RTCPeerConnection | undefined;

  private serverHeaders?: IMainCamHeaders;

  public constructor(
    apiManager: ApiManager,
    getConnection: () => RTCPeerConnection | undefined,
    { ignoreForCodec, onSetParameters }: IBalancerOptions = {},
  ) {
    this.eventHandler = new VideoSendingEventHandler(apiManager);
    this.getConnection = getConnection;
    this.parametersSetterWithQueue = new ParametersSetterWithQueue(onSetParameters);

    this.senderBalancer = new SenderBalancer(
      {
        senderFinder: new SenderFinder(),
        codecProvider: new CodecProvider(),
        parametersSetter: this.parametersSetterWithQueue,
      },
      {
        ignoreForCodec,
      },
    );
  }

  /**
   * Подписывается на события управления главной камерой
   */
  public subscribe(): void {
    this.eventHandler.subscribe(this.handleMainCamControl);
  }

  /**
   * Отписывается от событий и сбрасывает состояние
   */
  public unsubscribe(): void {
    this.eventHandler.unsubscribe();
    this.parametersSetterWithQueue.stop();
    this.reset();
  }

  /**
   * Сбрасывает состояние балансировщика
   */
  public reset(): void {
    delete this.serverHeaders;
  }

  /**
   * Выполняет балансировку на основе текущего состояния
   * @returns Promise с результатом балансировки
   */
  public async balance(): Promise<TResultSetParametersToSender> {
    const connection = this.getConnection();

    if (!connection) {
      throw new Error('connection is not exist');
    }

    return this.senderBalancer.balance(connection, this.serverHeaders);
  }

  /**
   * Обработчик событий управления главной камерой
   * @param headers - Заголовки от сервера
   */
  private readonly handleMainCamControl = (headers: IMainCamHeaders) => {
    this.serverHeaders = headers;
    this.balance().catch((error: unknown) => {
      debug('handleMainCamControl: error', error);
    });
  };
}

// Фабричная функция для обратной совместимости
const resolveVideoSendingBalancer = (
  apiManager: ApiManager,
  getConnection: () => RTCPeerConnection | undefined,
  options: IBalancerOptions = {},
) => {
  return new VideoSendingBalancer(apiManager, getConnection, options);
};

export default VideoSendingBalancer;
export { resolveVideoSendingBalancer };
