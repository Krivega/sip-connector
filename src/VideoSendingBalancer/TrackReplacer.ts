import resolveDebug from '@/logger';
import { BROWSER_RESPONSE_TIMEOUT_MS } from './constants';
import { KeyedSignal, createSignal } from './KeyedSignal';
import { raceWithTimeout } from './raceWithTimeout';

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
  // завершение оригинального replaceTrack последней принятой замены
  lastSettled: Promise<void>;
};

type TPreparation = { newTrack: MediaStreamTrack; isPrepared: boolean; chain: Promise<void> };

type TReplacement = {
  readonly newTrack: MediaStreamTrack | null;
  // завершение оригинала предыдущей замены этого отправителя: оригиналы вызываются по порядку замен
  readonly previous: Promise<void>;
  // оригинал вызван
  readonly called: Promise<void>;
  // оригинал завершился, успехом или ошибкой
  readonly settled: Promise<void>;
  readonly isCalled: () => boolean;
  // оригинал вызывается один раз — задачей очереди или по таймауту ожидания вызывающего; повторный вызов отдаёт его же исход
  readonly callOriginal: () => Promise<void>;
};

const createReplacement = (
  originalReplaceTrack: RTCRtpSender['replaceTrack'],
  newTrack: MediaStreamTrack | null,
  previous: Promise<void>,
): TReplacement => {
  let original: Promise<void> | undefined;
  const called = createSignal();
  const settled = createSignal();

  const startOriginal = async () => {
    called.resolve();

    try {
      await originalReplaceTrack(newTrack);
    } finally {
      settled.resolve();
    }
  };

  return {
    newTrack,
    previous,
    called: called.promise,
    settled: settled.promise,
    isCalled: () => {
      return original !== undefined;
    },
    callOriginal: async () => {
      original ??= startOriginal();

      return original;
    },
  };
};

// завершение очередной записи в отправитель: задачи его очереди или записи замены внутри задачи
type TNextWriteSettled = () => Promise<void>;

type TWaitOutcome = 'target' | 'write' | 'timeout';

// true — цель завершилась; false — BROWSER_RESPONSE_TIMEOUT_MS подряд не завершилась ни одна запись в отправитель: каждая завершённая запись начинает отсчёт заново
const settlesWhileWritesProgress = async (
  target: Promise<unknown>,
  nextWriteSettled: TNextWriteSettled,
): Promise<boolean> => {
  const resolveTarget = (): TWaitOutcome => {
    return 'target';
  };

  // что раньше: цель завершилась (отказ — тоже завершение), завершилась запись в отправитель или прошёл BROWSER_RESPONSE_TIMEOUT_MS
  const outcome = await raceWithTimeout<TWaitOutcome>(
    [
      target.then(resolveTarget, resolveTarget),
      nextWriteSettled().then((): TWaitOutcome => {
        return 'write';
      }),
    ],
    BROWSER_RESPONSE_TIMEOUT_MS,
    () => {
      return 'timeout';
    },
  );

  return outcome === 'write'
    ? settlesWhileWritesProgress(target, nextWriteSettled)
    : outcome === 'target';
};

/**
 * Ожидание замены вызывающим: записи параметров до оригинального replaceTrack и после него он ждёт, пока они завершаются, —
 * отпускается, только если BROWSER_RESPONSE_TIMEOUT_MS подряд не завершилась ни одна запись в отправитель
 * (задача его очереди или запись замены); сам оригинал — сколько отвечает браузер.
 * Вызывающий получает исход оригинала; задача замены остаётся в очереди и доделывает свои записи после зависшей
 */
const awaitReplacement = async (
  replacement: TReplacement,
  task: Promise<void>,
  nextWriteSettled: TNextWriteSettled,
): Promise<void> => {
  // отсчёт — от завершения оригинала предыдущей замены, а не от вызова: иначе при медленном браузере подготовка терялась бы и без зависших записей
  await replacement.previous;

  const isCalledInTime = await settlesWhileWritesProgress(replacement.called, nextWriteSettled);

  if (!isCalledInTime) {
    // исход задачи больше никто не ждёт, а без обработчика её отказ остался бы необработанным
    task.catch(() => {});

    // shortcut: оригинал вызывается мимо очереди и без подготовки, как без балансировщика
    return replacement.callOriginal();
  }

  await replacement.settled;

  const isFinishedInTime = await settlesWhileWritesProgress(task, nextWriteSettled);

  // не уложившиеся записи после оригинала задача доделает сама
  return isFinishedInTime ? task : replacement.callOriginal();
};

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
 * Записи до оригинала и после него вызывающий ждёт, пока они завершаются (awaitReplacement): его отпускают,
 * если BROWSER_RESPONSE_TIMEOUT_MS подряд не завершилась ни одна запись отправителя — задача его очереди, звено подготовки,
 * применение или откат после замены. Отпущенный до оригинала вызывает его мимо очереди, без подготовки.
 * Оригинал вызывается один раз и по порядку замен,
 * а задача замены остаётся в очереди и доделывает свои записи после зависшей.
 * Перехват остаётся и на отключённом отправителе, пока принятые им замены не завершились для вызывающего: так сохраняется их порядок.
 * Подключённый отправитель, исключённый балансировщиком (isExcludedSender), отключается, как только его замена завершится для вызывающего.
 */
export class TrackReplacer {
  private attached?: TInterception;

  private readonly interceptions = new WeakMap<RTCRtpSender, TInterception>();

  // у отправителя не больше одной подготовки: её создаёт только задача очереди, а очередь выполняет их по одной
  private readonly preparations = new WeakMap<RTCRtpSender, TPreparation>();

  // завершение записи замены в отправитель — звена подготовки, применения или отката после замены
  private readonly replacementWriteSettled = new KeyedSignal();

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
      lastSettled: Promise.resolve(),
    };

    this.interceptions.set(sender, interception);

    // eslint-disable-next-line no-param-reassign
    sender.replaceTrack = async (newTrack: MediaStreamTrack | null) => {
      interception.unfinishedReplacements += 1;

      const replacement = createReplacement(
        interception.originalReplaceTrack,
        newTrack,
        interception.lastSettled,
      );

      interception.lastSettled = replacement.settled;

      try {
        const task = this.taskQueue.add(sender, async () => {
          return this.replaceSenderTrack(sender, replacement);
        });

        await awaitReplacement(replacement, task, async () => {
          return this.nextWriteSettled(sender);
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
        // после замены запрашивается балансировка нового трека; политика сверки после замены описана в VideoSendingBalancer
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

  // записи в отправитель — задачи его очереди, а внутри задачи замены ещё и её записи; очереди других отправителей сюда не входят
  private async nextWriteSettled(sender: RTCRtpSender): Promise<void> {
    return Promise.race([
      this.taskQueue.nextSettled(sender),
      this.replacementWriteSettled.next(sender),
    ]);
  }

  private async replaceSenderTrack(sender: RTCRtpSender, replacement: TReplacement): Promise<void> {
    const { newTrack } = replacement;
    // оригинал, уже вызванный по таймауту ожидания, готовить поздно
    const preparation =
      replacement.isCalled() || newTrack === null || newTrack === sender.track
        ? undefined
        : { newTrack, isPrepared: false, chain: Promise.resolve() };

    if (preparation) {
      this.preparations.set(sender, preparation);
      this.addPreparationStep(sender);
    }

    await settlePreparation(preparation);

    try {
      await replacement.callOriginal();
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
      } finally {
        this.replacementWriteSettled.notify(sender);
      }
    });
  }

  private async applyActualTrackParameters(sender: RTCRtpSender): Promise<void> {
    try {
      await this.applyParameters(sender);
    } catch (error: unknown) {
      debug('applyParameters after replaceTrack: error', error);
    } finally {
      this.replacementWriteSettled.notify(sender);
    }
  }
}
