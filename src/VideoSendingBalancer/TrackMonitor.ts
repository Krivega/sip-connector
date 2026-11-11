import { SetTimeoutRequest } from '@krivega/timeout-requester';

/**
 * TrackMonitor следит за размером MediaStreamTrack:
 * при изменении разрешения (polling) вызывает callback.
 */
export class TrackMonitor {
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
   * Запускает слежение за размером трека с начального интервала опроса.
   */
  public subscribe(track: MediaStreamTrack, callback: () => void): void {
    this.unsubscribe();

    const { width, height } = track.getSettings();

    this.lastWidth = width;
    this.lastHeight = height;
    // запускаем адаптивный опрос
    this.currentPollIntervalMs = this.pollIntervalMs;
    this.schedulePoll(track, callback);
  }

  /** Останавливает всю активность мониторинга */
  public unsubscribe(): void {
    this.setTimeoutRequest.cancelRequest();

    this.lastWidth = undefined;
    this.lastHeight = undefined;
  }

  /**
   * Периодически опрашивает track с экспоненциальной адаптацией частоты.
   * При отсутствии изменений интервал удваивается до maxPollIntervalMs,
   * при обнаружении изменений сбрасывается до начального.
   */
  private schedulePoll(track: MediaStreamTrack, callback: () => void): void {
    const poll = () => {
      const { width, height } = track.getSettings();
      const isSizeChanged = width !== this.lastWidth || height !== this.lastHeight;

      this.lastWidth = width;
      this.lastHeight = height;
      // при изменениях — сброс интервала, иначе увеличиваем его, но не превышаем максимум
      this.currentPollIntervalMs = isSizeChanged
        ? this.pollIntervalMs
        : Math.min(this.currentPollIntervalMs * 2, this.maxPollIntervalMs);
      // следующий опрос планируется до callback: callback может синхронно снять или сменить подписку
      this.setTimeoutRequest.request(poll, this.currentPollIntervalMs);

      if (isSizeChanged) {
        callback();
      }
    };

    this.setTimeoutRequest.request(poll, this.currentPollIntervalMs);
  }
}
