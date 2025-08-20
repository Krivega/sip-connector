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

  private pollIntervalId?: number;

  private lastWidth?: number;

  private lastHeight?: number;

  private readonly pollIntervalMs: number;

  public constructor({ pollIntervalMs = 1000 }: { pollIntervalMs?: number }) {
    this.pollIntervalMs = pollIntervalMs;
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
    this.pollIntervalId = window.setInterval(() => {
      const { width: w, height: h } = track.getSettings();

      if (w !== this.lastWidth || h !== this.lastHeight) {
        this.lastWidth = w;
        this.lastHeight = h;
        callback();
      }
    }, this.pollIntervalMs);
  }

  private detachTrack(): void {
    if (this.pollIntervalId !== undefined) {
      clearInterval(this.pollIntervalId);
    }

    this.pollIntervalId = undefined;
    this.lastWidth = undefined;
    this.lastHeight = undefined;
  }
}
