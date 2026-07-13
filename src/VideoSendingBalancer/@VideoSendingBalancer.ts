import resolveDebug from '@/logger';
import { CodecProvider } from './CodecProvider';
import { ParametersSetterWithQueue } from './ParametersSetterWithQueue';
import { SenderBalancer } from './SenderBalancer';
import { SenderFinder } from './SenderFinder';
import { TrackMonitor } from './TrackMonitor';
import { VideoSendingEventHandler } from './VideoSendingEventHandler';

import type { ApiManager } from '@/ApiManager';
import type { TResultSetParametersToSender } from '@/tools';
import type { IBalancerOptions, IMainCamHeaders, TBalancingContext } from './types';

const debug = resolveDebug('VideoSendingBalancer');

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

  private readonly trackMonitor: TrackMonitor;

  public constructor(
    apiManager: ApiManager,
    getConnection: () => RTCPeerConnection | undefined,
    {
      ignoreForCodec,
      onSetParameters,
      pollIntervalMs,
    }: IBalancerOptions & {
      pollIntervalMs?: number;
    } = {},
  ) {
    this.getConnection = getConnection;
    this.eventHandler = new VideoSendingEventHandler(apiManager);
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

    this.trackMonitor = new TrackMonitor({ pollIntervalMs });
  }

  /**
   * Подписывается на события управления главной камерой
   */
  public subscribe(context: TBalancingContext = {}): void {
    this.eventHandler.subscribe(this.handleMainCamControl, context);
  }

  /**
   * Отписывается от событий и сбрасывает состояние
   */
  public unsubscribe(context: TBalancingContext = {}): void {
    this.eventHandler.unsubscribe();
    this.reset(context);
  }

  /**
   * Сбрасывает состояние балансировщика и восстанавливает параметры отправителя
   */
  public reset(context: TBalancingContext = {}): void {
    const maxResolution = context.getMaxResolution?.();

    this.clearState();

    const connection = this.getConnection();

    if (connection) {
      // eslint-disable-next-line no-void
      void this.senderBalancer
        .reset(connection, maxResolution)
        .catch((error: unknown) => {
          debug('reset sender encodings: error', error);
        })
        .finally(() => {
          this.parametersSetterWithQueue.stop();
        });
    } else {
      this.parametersSetterWithQueue.stop();
    }
  }

  /**
   * Выполняет балансировку на основе текущего состояния
   * @returns Promise с результатом балансировки
   */
  public async balance(context: TBalancingContext = {}): Promise<TResultSetParametersToSender> {
    const connection = this.getConnection();
    const maxResolution = context.getMaxResolution?.();

    if (!connection) {
      throw new Error('connection is not exist');
    }

    const result = await this.senderBalancer.balance(connection, this.serverHeaders, maxResolution);

    this.trackMonitor.subscribe(result.sender, () => {
      this.balance(context).catch((error: unknown) => {
        debug('balance on track change: error', error);
      });
    });

    return result;
  }

  private clearState(): void {
    delete this.serverHeaders;
    this.trackMonitor.unsubscribe();
  }

  /**
   * Обработчик событий управления главной камерой
   * @param headers - Заголовки от сервера
   */
  private readonly handleMainCamControl = (
    headers: IMainCamHeaders,
    context: TBalancingContext,
  ) => {
    this.serverHeaders = headers;
    this.balance(context).catch((error: unknown) => {
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
