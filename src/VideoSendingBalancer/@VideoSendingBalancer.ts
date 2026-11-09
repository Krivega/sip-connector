import resolveDebug from '@/logger';
import { CodecProvider } from './CodecProvider';
import { ParametersSetterWithQueue } from './ParametersSetterWithQueue';
import { SenderBalancer } from './SenderBalancer';
import { SenderFinder } from './SenderFinder';
import { TrackMonitor } from './TrackMonitor';

import type { TResultSetParametersToSender } from '@/tools';
import type { IBalancerOptions, IMainCamHeaders } from './types';

const debug = resolveDebug('VideoSendingBalancer');

/**
 * Контроллер/фасад для балансировки видеопотоков
 * Координирует работу балансировщика, слежения за треком и очереди задач
 */
class VideoSendingBalancer {
  private readonly senderBalancer: SenderBalancer;

  private readonly parametersSetterWithQueue: ParametersSetterWithQueue;

  private readonly getConnection: () => RTCPeerConnection | undefined;

  private serverHeaders?: IMainCamHeaders;

  private readonly trackMonitor: TrackMonitor;

  public constructor(
    getConnection: () => RTCPeerConnection | undefined,
    {
      ignoreForCodec,
      onSetParameters,
      pollIntervalMs,
      getMaxResolution,
    }: IBalancerOptions & {
      pollIntervalMs?: number;
    },
  ) {
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
        getMaxResolution,
        getServerHeaders: () => {
          return this.serverHeaders;
        },
      },
    );

    this.trackMonitor = new TrackMonitor({
      pollIntervalMs,
      beforeReplaceTrack: async (sender, newTrack) => {
        return this.senderBalancer.prepareTrackReplacement(sender, newTrack);
      },
      afterReplaceTrack: (sender, newTrack) => {
        this.senderBalancer.completeTrackReplacement(sender, newTrack);
      },
    });
  }

  /**
   * Сохраняет команду управления главной камерой для следующих балансировок
   * @param headers - Заголовки от сервера
   */
  public setServerHeaders(headers: IMainCamHeaders): void {
    this.serverHeaders = headers;
  }

  /**
   * Сбрасывает состояние балансировщика и восстанавливает параметры отправителя
   */
  public reset(): void {
    delete this.serverHeaders;
    this.trackMonitor.unsubscribe();

    const connection = this.getConnection();

    if (connection) {
      // eslint-disable-next-line no-void
      void this.senderBalancer
        .reset(connection)
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
  public async balance(): Promise<TResultSetParametersToSender> {
    const connection = this.getConnection();

    if (!connection) {
      throw new Error('connection is not exist');
    }

    const result = await this.senderBalancer.balance(connection);

    this.trackMonitor.subscribe(result.sender, this.handleTrackChange);

    return result;
  }

  private readonly handleTrackChange = () => {
    this.balance().catch((error: unknown) => {
      debug('balance on track change: error', error);
    });
  };
}

// Фабричная функция для обратной совместимости
const resolveVideoSendingBalancer = (
  getConnection: () => RTCPeerConnection | undefined,
  options: IBalancerOptions,
) => {
  return new VideoSendingBalancer(getConnection, options);
};

export default VideoSendingBalancer;
export { resolveVideoSendingBalancer };
