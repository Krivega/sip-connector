import resolveDebug from '@/logger';
import { setEncodingsToSender } from '@/tools';
import findVideoSender from '@/utils/peerConnection/findVideoSender';
import { CodecProvider } from './CodecProvider';
import { hasValidResolutionMainCam } from './resolveEncodingParameters';
import { RESULT_NO_CHANGED, SenderBalancer } from './SenderBalancer';
import { TaskQueue } from './TaskQueue';
import { TrackMonitor } from './TrackMonitor';
import { TrackReplacer } from './TrackReplacer';

import type { TResultSetParametersToSender } from '@/tools';
import type { IBalancerOptions, IMainCamHeaders } from './types';

// входы, по которым параметры отправителя посчитаны в последний раз
type TAppliedInputs = {
  sender: RTCRtpSender;
  track: MediaStreamTrack | null;
  width?: number;
  height?: number;
};

type TStartedState = { readonly kind: 'started'; appliedInputs?: TAppliedInputs };

type TState = { readonly kind: 'idle' | 'warmup' } | TStartedState;

const resolveInputs = (sender: RTCRtpSender): TAppliedInputs => {
  const { track } = sender;
  const { width, height } = track?.getSettings() ?? {};

  return { sender, track, width, height };
};

const debug = resolveDebug('VideoSendingBalancer');

/**
 * Контроллер/фасад для балансировки видеопотоков
 * Владеет состоянием балансировки (idle, warmup, started) и командой сервера:
 * что применить отправителю, решает состояние на момент выполнения операции.
 * Координирует работу балансировщика, замены трека, сверки по тику и очереди задач
 */
class VideoSendingBalancer {
  private readonly senderBalancer: SenderBalancer;

  private readonly codecProvider: CodecProvider;

  private readonly taskQueue: TaskQueue;

  private readonly getConnection: () => RTCPeerConnection | undefined;

  private readonly isExcludedSender: (sender: RTCRtpSender) => boolean;

  private serverHeaders?: IMainCamHeaders;

  // каждый переход создаёт новый объект: его идентичность отличает операции прошлого состояния и служит токеном запуска
  private state: TState = { kind: 'idle' };

  private readonly trackMonitor: TrackMonitor;

  private readonly trackReplacer: TrackReplacer;

  public constructor(
    getConnection: () => RTCPeerConnection | undefined,
    {
      ignoreForCodec,
      onSetParameters,
      pollIntervalMs,
      getMaxResolution,
      isExcludedSender = () => {
        return false;
      },
    }: IBalancerOptions & {
      pollIntervalMs?: number;
    },
  ) {
    this.getConnection = getConnection;
    this.isExcludedSender = isExcludedSender;
    this.codecProvider = new CodecProvider();
    this.taskQueue = new TaskQueue();
    this.senderBalancer = new SenderBalancer(
      {
        parametersSetter: {
          setEncodingsToSender: async (sender, parameters) => {
            return setEncodingsToSender(sender, parameters, (appliedParameters) => {
              // параметры уже применены: исключение подписчика не должно отклонять операцию
              try {
                onSetParameters?.(appliedParameters);
              } catch (error: unknown) {
                debug('onSetParameters: error', error);
              }
            });
          },
        },
      },
      {
        ignoreForCodec,
        getMaxResolution,
      },
    );

    this.trackMonitor = new TrackMonitor({ pollIntervalMs });
    this.trackReplacer = new TrackReplacer({
      taskQueue: this.taskQueue,
      isBalancing: this.isBalancing,
      applyParameters: async (sender, upcomingTrack) => {
        try {
          return await this.applyParameters(sender, { upcomingTrack });
        } catch (error: unknown) {
          this.retryOnTick(sender);

          throw error;
        }
      },
      requestBalance: this.balanceAfterReplacement,
    });
  }

  /**
   * Токен действующего запуска: меняется при каждом start(), stop() и начале прогрева
   */
  public get runToken(): object {
    return this.state;
  }

  /**
   * Принимает команду управления главной камерой: во время прогрева запоминает её,
   * при запущенной балансировке — запоминает и применяет; иначе команда не принимается
   * @param headers - Заголовки от сервера
   */
  public handleServerHeaders(headers: IMainCamHeaders): void {
    const { kind } = this.state;

    if (kind === 'idle') {
      return;
    }

    // команда с некорректным разрешением не принимается: в силе остаётся прежняя
    if (!hasValidResolutionMainCam(headers)) {
      debug('handleServerHeaders: invalid resolutionMainCam', headers.resolutionMainCam);

      return;
    }

    this.serverHeaders = headers;

    if (kind === 'started') {
      // идущей замене команда нужна до конца оригинального replaceTrack, а не после него
      this.trackReplacer.prepareOngoingReplacement();
      this.balance().catch((error: unknown) => {
        debug('balance on main-cam-control: error', error);
      });
    }
  }

  /**
   * Начинает прогрев перед запуском: параметры не ужесточаются,
   * перехват замены трека включается сразу, чтобы замены прогрева не потерялись для запуска.
   * Запущенную балансировку не затрагивает
   */
  public warmUp(): void {
    if (this.state.kind === 'started') {
      return;
    }

    this.state = { kind: 'warmup' };
    this.attachVideoSender(this.getConnection()?.getSenders() ?? []);
  }

  /**
   * Запускает балансировку: включает перехват замены трека и сверку по тику,
   * применяет сохранённую команду
   * @returns Promise с результатом первой балансировки
   */
  public async start(): Promise<TResultSetParametersToSender> {
    const state: TStartedState = { kind: 'started' };

    this.state = state;
    this.trackReplacer.prepareOngoingReplacement();
    // сверка идёт весь запуск и не зависит от исхода первой балансировки: она же повторит неудавшуюся
    this.trackMonitor.subscribe(async () => {
      return this.reconcile(state);
    });

    return this.balance();
  }

  /**
   * Останавливает балансировку: стирает команду, отключает перехват замены трека и сверку по тику
   * и восстанавливает параметры отправителя по разрешению трека
   */
  public stop(): void {
    // до отключения перехвата: подключённый отправитель может быть без трека, и поиск его не найдёт
    const sender = this.resolveResetSender();

    this.state = { kind: 'idle' };
    this.trackMonitor.unsubscribe();
    delete this.serverHeaders;
    this.trackReplacer.detach();

    if (sender) {
      // без запроса кодека и сразу в очередь: после замен, принятых до остановки, и раньше следующих, пока перехват остаётся на отправителе
      this.taskQueue
        .add(sender, async () => {
          return this.applyParameters(sender);
        })
        .catch((error: unknown) => {
          debug('reset sender encodings: error', error);
        });
    }
  }

  /**
   * Выполняет балансировку на основе текущего состояния: во время прогрева ничего не делает
   * @returns Promise с результатом балансировки
   */
  public async balance(): Promise<TResultSetParametersToSender> {
    const { state } = this;

    if (state.kind === 'warmup') {
      return RESULT_NO_CHANGED;
    }

    try {
      const connection = this.getConnection();

      if (!connection) {
        throw new Error('connection is not exist');
      }

      const senders = connection.getSenders();
      // перехват включается синхронно: замена трека, вызванная до конца балансировки, не должна пройти мимо очереди
      const sender =
        state.kind === 'started' ? this.attachVideoSender(senders) : this.findVideoSender(senders);

      if (!sender) {
        return RESULT_NO_CHANGED;
      }

      // shortcut: таймаута нет — при зависшем getStats эта балансировка не завершится; очередь и замена трека от него не зависят
      const codec = await this.codecProvider.getCodecFromSender(sender);

      return await this.taskQueue.add(sender, async () => {
        // балансировка, начатая в прошлом состоянии, устарела
        if (this.state !== state) {
          return RESULT_NO_CHANGED;
        }

        // входы читаются до применения: изменившееся за его время должно остаться расхождением для сверки
        const inputs = resolveInputs(sender);
        const result = await this.applyParameters(sender, { codec });

        if (state.kind === 'started') {
          state.appliedInputs = inputs;
        }

        return result;
      });
    } catch (error: unknown) {
      // после своей ошибки входы считаются не применёнными: сверка по тику повторит балансировку
      if (state.kind === 'started') {
        state.appliedInputs = undefined;
      }

      throw error;
    }
  }

  // сверка по тику: балансирует, только если изменились собственные входы — отправитель, его трек или размер трека
  private async reconcile(state: TStartedState): Promise<boolean> {
    if (!this.hasInputsChanged(state.appliedInputs)) {
      return false;
    }

    try {
      const { isChanged } = await this.balance();

      // без видео-отправителя интервал не растёт: появившегося отправителя ограничит ближайший тик
      return isChanged || this.findConnectionVideoSender() === undefined;
    } catch (error: unknown) {
      debug('balance on reconcile: error', error);

      return false;
    }
  }

  // при замене трека параметры подключённого отправителя не встали: сверка повторит балансировку с начального интервала
  private retryOnTick(sender: RTCRtpSender): void {
    const { state } = this;

    // сбой чужого отправителя, например прошлого звонка, текущий запуск не затрагивает
    if (state.kind === 'started' && this.isBalancing(sender)) {
      state.appliedInputs = undefined;
      this.trackMonitor.resetInterval();
    }
  }

  private findConnectionVideoSender(): RTCRtpSender | undefined {
    return this.findVideoSender(this.getConnection()?.getSenders() ?? []);
  }

  // исключённого отправителя (например, демонстрации) балансировщик не выбирает и не трогает
  private findVideoSender(senders: RTCRtpSender[]): RTCRtpSender | undefined {
    return findVideoSender(
      senders.filter((sender) => {
        return !this.isExcludedSender(sender);
      }),
    );
  }

  private hasInputsChanged(appliedInputs?: TAppliedInputs): boolean {
    const sender = this.findConnectionVideoSender();

    if (!appliedInputs || !sender) {
      return true;
    }

    const { track, width, height } = resolveInputs(sender);

    return (
      appliedInputs.sender !== sender ||
      appliedInputs.track !== track ||
      appliedInputs.width !== width ||
      appliedInputs.height !== height
    );
  }

  private attachVideoSender(senders: RTCRtpSender[]): RTCRtpSender | undefined {
    const sender = this.findVideoSender(senders);

    if (sender) {
      this.trackReplacer.attach(sender);
    } else if (!this.hasAttachedSender(senders)) {
      this.trackReplacer.detach();
    }

    return sender;
  }

  // подключённый отправитель, оставшийся в соединении без трека, сохраняет перехват: он нужен, чтобы ограничить его следующую замену
  private hasAttachedSender(senders: RTCRtpSender[]): boolean {
    const { attachedSender } = this.trackReplacer;

    return attachedSender !== undefined && senders.includes(attachedSender);
  }

  private resolveResetSender(): RTCRtpSender | undefined {
    const connection = this.getConnection();

    return connection
      ? (this.trackReplacer.attachedSender ?? this.findVideoSender(connection.getSenders()))
      : undefined;
  }

  // точка допуска: что применить отправителю, решает состояние на момент выполнения операции
  private async applyParameters(
    sender: RTCRtpSender,
    {
      codec = this.codecProvider.getKnownCodec(sender),
      upcomingTrack,
    }: { codec?: string; upcomingTrack?: MediaStreamTrack } = {},
  ): Promise<TResultSetParametersToSender> {
    return this.senderBalancer.apply(sender, {
      codec,
      upcomingTrack,
      serverHeaders: this.isBalancing(sender) ? this.serverHeaders : undefined,
      // пока отправка прогревается, скалирование применять нельзя
      isLooseningOnly: this.state.kind === 'warmup',
    });
  }

  // «с командой»: балансировка запущена, а отправитель подключён; отправителю прошлого звонка команда нового чужая
  private readonly isBalancing = (sender: RTCRtpSender): boolean => {
    return this.state.kind === 'started' && this.trackReplacer.attachedSender === sender;
  };

  private readonly balanceAfterReplacement = () => {
    // новый трек может менять размер: сверка возвращается к начальному интервалу
    this.trackMonitor.resetInterval();
    this.balance().catch((error: unknown) => {
      debug('balance on track change: error', error);
    });
  };
}

export default VideoSendingBalancer;
