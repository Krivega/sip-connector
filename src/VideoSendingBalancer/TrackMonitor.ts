import { SetTimeoutRequest } from '@krivega/timeout-requester';

/**
 * TrackMonitor следит за изменением MediaStreamTrack, который отправляется
 * локальным RTCRtpSender-ом.
 *
 * 1. Обнаруживает смену sender или его track (replaceTrack).
 * 2. При изменении разрешения (resize-event или polling) вызывает callback.
 * 3. При replaceTrack вызывает callback сразу после замены и перенастраивает слежение.
 */
export class TrackMonitor {
  private currentSender?: RTCRtpSender;

  private originalReplaceTrack?: RTCRtpSender['replaceTrack'];

  private lastWidth?: number;

  private lastHeight?: number;

  private readonly maxPollIntervalMs: number;

  private currentPollIntervalMs: number;

  private readonly pollIntervalMs: number;

  private readonly setTimeoutRequest: SetTimeoutRequest;

  public constructor({
    pollIntervalMs = 1000,
    maxPollIntervalMs,
  }: {
    pollIntervalMs?: number;
    maxPollIntervalMs?: number;
  }) {
    this.pollIntervalMs = pollIntervalMs;
    // default max ~ 16x initial
    this.maxPollIntervalMs = maxPollIntervalMs ?? pollIntervalMs * 16;
    this.currentPollIntervalMs = this.pollIntervalMs;
    this.setTimeoutRequest = new SetTimeoutRequest();
  }

  /**
   * Проверяет актуальный video-sender и (при необходимости) перенастраивает наблюдение.
   */
  public subscribe(sender: RTCRtpSender | undefined, callback: () => void): void {
    if (!sender) {
      this.detachSender();

      return;
    }

    if (this.currentSender === sender) {
      // sender не изменился — track может быть тем же, либо уже заменён через replaceTrack,
      // но обёртка replaceTrack сама вызовет attachTrack при замене, поэтому нечего делать.
      return;
    }

    // sender изменился (например, renegotiation) — перенастраиваем.
    this.detachSender();
    this.attachSender(sender, callback);
  }

  /** Останавливает всю активность мониторинга */
  public unsubscribe(): void {
    this.detachSender();
  }

  private attachSender(sender: RTCRtpSender, callback: () => void): void {
    this.currentSender = sender;

    // Сохраним оригинальный replaceTrack, чтобы вернуть при детаче
    const originalReplaceTrack = sender.replaceTrack.bind(sender);

    this.originalReplaceTrack = originalReplaceTrack;
    // переопределяем существующий метод только внутри мониторинга
    // eslint-disable-next-line no-param-reassign
    sender.replaceTrack = async (newTrack: MediaStreamTrack | null) => {
      await originalReplaceTrack(newTrack);

      // После успешной замены трека – обновляем слежение и уведомляем
      this.attachTrack(callback, newTrack ?? undefined);
      callback();
    };

    this.attachTrack(callback, sender.track as MediaStreamTrack | undefined);
  }

  private detachSender(): void {
    // Вернём оригинальный replaceTrack если он был патчен
    if (this.currentSender && this.originalReplaceTrack) {
      // восстановление оригинального метода
      this.currentSender.replaceTrack = this.originalReplaceTrack;
    }

    this.originalReplaceTrack = undefined;
    this.currentSender = undefined;

    this.detachTrack();
  }

  private attachTrack(callback: () => void, track?: MediaStreamTrack): void {
    this.detachTrack();

    if (!track) {
      return;
    }

    const { width, height } = track.getSettings();

    this.lastWidth = width;
    this.lastHeight = height;
    // запускаем адаптивный опрос
    this.currentPollIntervalMs = this.pollIntervalMs;
    this.schedulePoll(track, callback);
  }

  /**
   * Периодически опрашивает track с экспоненциальной адаптацией частоты.
   * При отсутствии изменений интервал удваивается до maxPollIntervalMs,
   * при обнаружении изменений сбрасывается до начального.
   */
  private schedulePoll(track: MediaStreamTrack, callback: () => void): void {
    const poll = () => {
      const { width: w, height: h } = track.getSettings();

      if (w !== this.lastWidth || h !== this.lastHeight) {
        this.lastWidth = w;
        this.lastHeight = h;
        this.currentPollIntervalMs = this.pollIntervalMs; // сброс при изменениях
        callback();
      } else {
        // нет изменений — увеличиваем интервал, но не превышаем максимум
        this.currentPollIntervalMs = Math.min(
          this.currentPollIntervalMs * 2,
          this.maxPollIntervalMs,
        );
      }

      this.setTimeoutRequest.request(poll, this.currentPollIntervalMs);
    };

    this.setTimeoutRequest.request(poll, this.currentPollIntervalMs);
  }

  private detachTrack(): void {
    this.setTimeoutRequest.cancelRequest();

    this.lastWidth = undefined;
    this.lastHeight = undefined;
  }
}
