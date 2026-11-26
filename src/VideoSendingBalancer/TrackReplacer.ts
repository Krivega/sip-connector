import resolveDebug from '@/logger';

import type { ITaskQueue } from './types';

const debug = resolveDebug('TrackReplacer');

type TApplyParameters = (
  sender: RTCRtpSender,
  upcomingTrack?: MediaStreamTrack,
) => Promise<unknown>;

type TInterception = {
  sender: RTCRtpSender;
  originalReplaceTrack: RTCRtpSender['replaceTrack'];
  unfinishedReplacements: number;
};

type TPreparation = { newTrack: MediaStreamTrack; isPrepared: boolean; chain: Promise<void> };

// ждёт, пока цепочка подготовки не перестанет расти
const settlePreparation = async (preparation?: TPreparation): Promise<void> => {
  const chain = preparation?.chain;

  await chain;

  if (preparation?.chain !== chain) {
    await settlePreparation(preparation);
  }
};

/**
 * TrackReplacer перехватывает replaceTrack отправителя и выполняет замену одной задачей его очереди:
 *
 * 1. Перед заменой на новый трек применяет более строгие параметры — первое звено цепочки подготовки;
 *    пока идёт замена, prepareOngoingReplacement добавляет звенья. Ошибка звена логируется и замену не отменяет.
 * 2. Дожидается цепочки и вызывает оригинальный replaceTrack; после его возврата снова дожидается цепочки.
 * 3. При ошибке оригинала возвращает параметры оставшегося трека, если выполнялось хотя бы одно звено,
 *    и отклоняет замену этой ошибкой.
 * 4. После успешной замены применяет параметры трека, оказавшегося на отправителе,
 *    и, если трек есть, запрашивает обычную балансировку.
 *
 * Звенья и шаг 4 выполняются, только если на момент их выполнения балансировка запущена, а отправитель подключён (attach).
 * Иначе перехват только ставит замену в очередь отправителя: порядок сохраняется, параметры не меняются.
 * Перехват остаётся и на отключённом отправителе, пока не завершены принятые им замены: так сохраняется их порядок.
 * Подключённый отправитель, исключённый балансировщиком (isExcludedSender), отключается, как только завершится его замена.
 */
export class TrackReplacer {
  private attached?: TInterception;

  private readonly interceptions = new WeakMap<RTCRtpSender, TInterception>();

  // у отправителя не больше одной идущей замены: очередь выполняет их по одной
  private readonly preparations = new WeakMap<RTCRtpSender, TPreparation>();

  private readonly taskQueue: ITaskQueue;

  private readonly isBalancing: (sender: RTCRtpSender) => boolean;

  private readonly isExcludedSender: (sender: RTCRtpSender) => boolean;

  private readonly applyParameters: TApplyParameters;

  private readonly requestBalance: () => void;

  public constructor({
    taskQueue,
    isBalancing,
    isExcludedSender,
    applyParameters,
    requestBalance,
  }: {
    taskQueue: ITaskQueue;
    isBalancing: (sender: RTCRtpSender) => boolean;
    isExcludedSender: (sender: RTCRtpSender) => boolean;
    applyParameters: TApplyParameters;
    requestBalance: () => void;
  }) {
    this.taskQueue = taskQueue;
    this.isBalancing = isBalancing;
    this.isExcludedSender = isExcludedSender;
    this.applyParameters = applyParameters;
    this.requestBalance = requestBalance;
  }

  public get attachedSender(): RTCRtpSender | undefined {
    return this.attached?.sender;
  }

  /**
   * Подключает отправителя и подменяет его replaceTrack; для уже подключённого отправителя ничего не делает.
   */
  public attach(sender: RTCRtpSender): void {
    if (this.isAttachedTo(sender)) {
      return;
    }

    this.detach();

    // перехват, оставшийся с прошлого подключения, используется снова
    this.attached = this.interceptions.get(sender) ?? this.intercept(sender);
  }

  /** Отключает отправителя; оригинальный replaceTrack возвращается ему после завершения принятых замен */
  public detach(): void {
    const interception = this.attached;

    if (!interception) {
      return;
    }

    this.attached = undefined;
    this.restoreUnusedReplaceTrack(interception);
  }

  /** Добавляет звено в подготовку замены, которая идёт у подключённого отправителя; без такой замены ничего не делает */
  public prepareOngoingReplacement(): void {
    if (this.attached) {
      this.addPreparationStep(this.attached.sender);
    }
  }

  private isAttachedTo(sender: RTCRtpSender): boolean {
    return this.attachedSender === sender;
  }

  private intercept(sender: RTCRtpSender): TInterception {
    const interception: TInterception = {
      sender,
      // Сохраним оригинальный replaceTrack, чтобы вернуть его отправителю
      originalReplaceTrack: sender.replaceTrack.bind(sender),
      unfinishedReplacements: 0,
    };

    this.interceptions.set(sender, interception);

    // eslint-disable-next-line no-param-reassign
    sender.replaceTrack = async (newTrack: MediaStreamTrack | null) => {
      interception.unfinishedReplacements += 1;

      try {
        await this.taskQueue.add(sender, async () => {
          return this.replaceSenderTrack(sender, newTrack, interception.originalReplaceTrack);
        });
      } finally {
        interception.unfinishedReplacements -= 1;

        // иначе следующие замены исключённого отправителя (например, демонстрации) ждали бы в очереди до ближайшей балансировки
        if (this.isAttachedTo(sender) && this.isExcludedSender(sender)) {
          this.detach();
        } else {
          this.restoreUnusedReplaceTrack(interception);
        }
      }

      // без трека балансировать нечего
      if (this.isBalancing(sender) && sender.track) {
        // вызывающий код сразу после replaceTrack сам меняет параметры; балансировка перекрывает их, потому что сначала асинхронно получает кодек
        this.requestBalance();
      }
    };

    return interception;
  }

  private restoreUnusedReplaceTrack(interception: TInterception): void {
    const { sender, originalReplaceTrack, unfinishedReplacements } = interception;

    if (this.isAttachedTo(sender) || unfinishedReplacements > 0) {
      return;
    }

    // shortcut: замена, вызванная после этого, идёт мимо очереди и не упорядочена с её задачами; такие замены сериализует потребитель
    sender.replaceTrack = originalReplaceTrack;
    this.interceptions.delete(sender);
  }

  private async replaceSenderTrack(
    sender: RTCRtpSender,
    newTrack: MediaStreamTrack | null,
    originalReplaceTrack: RTCRtpSender['replaceTrack'],
  ): Promise<void> {
    const preparation =
      newTrack === null || newTrack === sender.track
        ? undefined
        : { newTrack, isPrepared: false, chain: Promise.resolve() };

    if (preparation) {
      this.preparations.set(sender, preparation);
      this.addPreparationStep(sender);
    }

    await settlePreparation(preparation);

    try {
      await originalReplaceTrack(newTrack);
    } catch (error: unknown) {
      await this.finishPreparation(sender);

      // трек остался прежним, а подготовка этой замены могла ужесточить его параметры; возвращаем их, даже если отправителя уже отключили
      if (preparation?.isPrepared === true) {
        await this.applyActualTrackParameters(sender);
      }

      throw error;
    }

    await this.finishPreparation(sender);

    // подготовка держала строжайшее из двух треков, а балансировка после замены ещё ждёт кодек: параметры фактического трека нужны сразу
    if (this.isBalancing(sender)) {
      await this.applyActualTrackParameters(sender);
    }
  }

  // звенья, добавленные во время оригинального replaceTrack, завершаются до отката и применения после замены
  private async finishPreparation(sender: RTCRtpSender): Promise<void> {
    await settlePreparation(this.preparations.get(sender));
    this.preparations.delete(sender);
  }

  // звенья идут друг за другом, а очередь отправителя занята заменой: записи параметров не пересекаются
  private addPreparationStep(sender: RTCRtpSender): void {
    const preparation = this.preparations.get(sender);

    if (!preparation) {
      return;
    }

    preparation.chain = preparation.chain.then(async () => {
      if (!this.isBalancing(sender)) {
        return;
      }

      preparation.isPrepared = true;

      try {
        await this.applyParameters(sender, preparation.newTrack);
      } catch (error: unknown) {
        // подготовка не должна срывать замену: подключённому отправителю параметры нового трека применятся после неё
        debug('applyParameters before replaceTrack: error', error);
      }
    });
  }

  private async applyActualTrackParameters(sender: RTCRtpSender): Promise<void> {
    try {
      await this.applyParameters(sender);
    } catch (error: unknown) {
      debug('applyParameters after replaceTrack: error', error);
    }
  }
}
