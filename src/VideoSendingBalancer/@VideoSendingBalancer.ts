import resolveDebug from '@/logger';
import { setEncodingsToSender } from '@/tools';
import { CodecProvider } from './CodecProvider';
import { RESULT_NO_CHANGED, SenderBalancer } from './SenderBalancer';
import { SenderFinder } from './SenderFinder';
import { TaskQueue } from './TaskQueue';
import { TrackMonitor } from './TrackMonitor';
import { TrackReplacer } from './TrackReplacer';

import type { TResultSetParametersToSender } from '@/tools';
import type { IBalancerOptions, IMainCamHeaders } from './types';

const debug = resolveDebug('VideoSendingBalancer');

/**
 * Контроллер/фасад для балансировки видеопотоков
 * Координирует работу балансировщика, замены трека, слежения за треком и очереди задач
 */
class VideoSendingBalancer {
  private readonly senderBalancer: SenderBalancer;

  private readonly codecProvider: CodecProvider;

  private readonly senderFinder: SenderFinder;

  private readonly taskQueue: TaskQueue;

  private readonly getConnection: () => RTCPeerConnection | undefined;

  private serverHeaders?: IMainCamHeaders;

  private isStarted = false;

  private readonly trackMonitor: TrackMonitor;

  private readonly trackReplacer: TrackReplacer;

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
    this.codecProvider = new CodecProvider();
    this.senderFinder = new SenderFinder();
    this.taskQueue = new TaskQueue();
    this.senderBalancer = new SenderBalancer(
      {
        parametersSetter: {
          setEncodingsToSender: async (sender, parameters) => {
            return setEncodingsToSender(sender, parameters, onSetParameters);
          },
        },
      },
      {
        ignoreForCodec,
        getMaxResolution,
        // до старта команда только запомнена: балансировки, начатые до остановки, не должны её применить
        getServerHeaders: () => {
          return this.isStarted ? this.serverHeaders : undefined;
        },
      },
    );

    this.trackMonitor = new TrackMonitor({ pollIntervalMs });
    this.trackReplacer = new TrackReplacer({
      taskQueue: this.taskQueue,
      applyParameters: async (sender, upcomingTrack) => {
        return this.senderBalancer.apply(sender, { upcomingTrack });
      },
      onTrackChange: this.handleSenderTrackChange,
      requestBalance: this.requestBalance,
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
   * Запускает балансировку: применяет сохранённую команду,
   * включает перехват замены трека и слежение за размером трека
   * @returns Promise с результатом первой балансировки
   */
  public async start(): Promise<TResultSetParametersToSender> {
    this.isStarted = true;

    return this.balance();
  }

  /**
   * Останавливает балансировку: стирает команду, снимает перехват замены трека и слежение,
   * начинает очередь заново и восстанавливает параметры отправителя по разрешению трека
   */
  public stop(): void {
    this.isStarted = false;
    delete this.serverHeaders;
    this.trackReplacer.detach();
    // операция, зависшая до остановки, не должна задерживать сброс параметров и следующие запуски
    this.taskQueue.reset();

    if (this.getConnection()) {
      this.balance().catch((error: unknown) => {
        debug('reset sender encodings: error', error);
      });
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

    const sender = this.senderFinder.findVideoSender(connection.getSenders());

    if (!sender) {
      this.trackReplacer.detach();

      return RESULT_NO_CHANGED;
    }

    // перехват включается синхронно: замена трека, вызванная до конца балансировки, не должна пройти мимо очереди
    if (this.isStarted) {
      this.trackReplacer.attach(sender);
    }

    // shortcut: таймаута нет — при зависшем getStats эта балансировка не завершится; очередь и замена трека от него не зависят
    const codec = await this.codecProvider.getCodecFromSender(sender);

    return this.taskQueue.add(async () => {
      return this.senderBalancer.apply(sender, { codec });
    });
  }

  private readonly handleSenderTrackChange = (track: MediaStreamTrack | undefined) => {
    if (track) {
      this.trackMonitor.subscribe(track, this.requestBalance);
    } else {
      this.trackMonitor.unsubscribe();
    }
  };

  private readonly requestBalance = () => {
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
