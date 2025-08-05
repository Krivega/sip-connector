import { debug } from '@/logger';
import type { TResult } from '@/setParametersToSender';
import type { SipConnector } from '@/SipConnector';
import { CodecProvider } from './CodecProvider';
import { ParametersSetterWithQueue } from './ParametersSetterWithQueue';
import { SenderBalancer } from './SenderBalancer';
import { SenderFinder } from './SenderFinder';
import type { IBalancerOptions, IMainCamHeaders } from './types';
import { VideoSendingEventHandler } from './VideoSendingEventHandler';

/**
 * Контроллер/фасад для балансировки видеопотоков
 * Координирует работу обработчика событий, балансировщика и очереди задач
 */
class VideoSendingBalancer {
  private readonly eventHandler: VideoSendingEventHandler;

  private readonly senderBalancer: SenderBalancer;

  private readonly parametersSetterWithQueue: ParametersSetterWithQueue;

  private serverHeaders?: IMainCamHeaders;

  public constructor(
    sipConnector: SipConnector,
    { ignoreForCodec, onSetParameters }: IBalancerOptions = {},
  ) {
    this.eventHandler = new VideoSendingEventHandler(sipConnector);

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
   * Перебалансирует текущее состояние
   * @returns Promise с результатом балансировки
   */
  public async reBalance(): Promise<TResult> {
    return this.balanceByTrack();
  }

  /**
   * Выполняет балансировку на основе текущего состояния
   * @returns Promise с результатом балансировки
   */
  private async balanceByTrack(): Promise<TResult> {
    const connection = this.eventHandler.getConnection();

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
    this.balanceByTrack().catch(debug);
  };
}

// Фабричная функция для обратной совместимости
const resolveVideoSendingBalancer = (
  sipConnector: SipConnector,
  options: IBalancerOptions = {},
) => {
  return new VideoSendingBalancer(sipConnector, options);
};

export default VideoSendingBalancer;
export { resolveVideoSendingBalancer };
