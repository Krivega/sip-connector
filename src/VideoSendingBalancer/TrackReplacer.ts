import resolveDebug from '@/logger';

import type { ITaskQueue } from './types';

const debug = resolveDebug('TrackReplacer');

type TApplyParameters = (
  sender: RTCRtpSender,
  upcomingTrack?: MediaStreamTrack,
) => Promise<unknown>;

type TOnTrackChange = (track: MediaStreamTrack | undefined) => void;

/**
 * TrackReplacer перехватывает replaceTrack отправителя и выполняет замену одной задачей очереди:
 *
 * 1. Перед заменой на новый трек применяет более строгий масштаб без запроса кодека;
 *    ошибка этого шага логируется и замену не отменяет.
 * 2. Вызывает оригинальный replaceTrack.
 * 3. При ошибке шага 2 возвращает параметры оставшегося трека и отклоняет замену этой ошибкой.
 * 4. После успешной замены сообщает через onTrackChange, какой трек теперь на отправителе,
 *    и, если трек есть, запрашивает обычную балансировку.
 */
export class TrackReplacer {
  private attached?: { sender: RTCRtpSender; originalReplaceTrack: RTCRtpSender['replaceTrack'] };

  private readonly taskQueue: ITaskQueue;

  private readonly applyParameters: TApplyParameters;

  private readonly onTrackChange: TOnTrackChange;

  private readonly requestBalance: () => void;

  public constructor({
    taskQueue,
    applyParameters,
    onTrackChange,
    requestBalance,
  }: {
    taskQueue: ITaskQueue;
    applyParameters: TApplyParameters;
    onTrackChange: TOnTrackChange;
    requestBalance: () => void;
  }) {
    this.taskQueue = taskQueue;
    this.applyParameters = applyParameters;
    this.onTrackChange = onTrackChange;
    this.requestBalance = requestBalance;
  }

  /**
   * Подменяет replaceTrack отправителя; для уже подключённого отправителя ничего не делает.
   */
  public attach(sender: RTCRtpSender): void {
    if (this.attached?.sender === sender) {
      return;
    }

    this.detach();

    // Сохраним оригинальный replaceTrack, чтобы вернуть при детаче
    const originalReplaceTrack = sender.replaceTrack.bind(sender);

    this.attached = { sender, originalReplaceTrack };

    // eslint-disable-next-line no-param-reassign
    sender.replaceTrack = async (newTrack: MediaStreamTrack | null) => {
      await this.taskQueue.add(async () => {
        return this.replaceSenderTrack(sender, newTrack, originalReplaceTrack);
      });

      // без трека балансировать нечего; перехват остаётся до следующей балансировки, которая снимет его, не найдя трек
      if (sender.track) {
        // вызывающий код сразу после replaceTrack сам меняет параметры; балансировка перекрывает их, потому что сначала асинхронно получает кодек
        this.requestBalance();
      }
    };

    this.onTrackChange(sender.track ?? undefined);
  }

  /** Возвращает отправителю оригинальный replaceTrack */
  public detach(): void {
    if (!this.attached) {
      return;
    }

    const { sender, originalReplaceTrack } = this.attached;

    // shortcut: после detach вызовы replaceTrack идут мимо очереди, замены сериализует потребитель
    sender.replaceTrack = originalReplaceTrack;
    this.attached = undefined;

    this.onTrackChange(undefined);
  }

  private async replaceSenderTrack(
    sender: RTCRtpSender,
    newTrack: MediaStreamTrack | null,
    originalReplaceTrack: RTCRtpSender['replaceTrack'],
  ): Promise<void> {
    if (newTrack !== null && newTrack !== sender.track) {
      try {
        await this.applyParameters(sender, newTrack);
      } catch (error: unknown) {
        // подготовка не должна срывать замену: параметры нового трека применит балансировка после замены
        debug('applyParameters before replaceTrack: error', error);
      }
    }

    try {
      await originalReplaceTrack(newTrack);
    } catch (error: unknown) {
      // трек остался прежним, а подготовка могла ужесточить его параметры
      await this.applyActualTrackParameters(sender);

      throw error;
    }

    // от отправителя могли отключиться во время замены — не возобновляем слежение
    if (this.attached?.sender === sender) {
      this.onTrackChange(sender.track ?? undefined);
    }
  }

  private async applyActualTrackParameters(sender: RTCRtpSender): Promise<void> {
    try {
      await this.applyParameters(sender);
    } catch (error: unknown) {
      debug('applyParameters after replaceTrack: error', error);
    }
  }
}
