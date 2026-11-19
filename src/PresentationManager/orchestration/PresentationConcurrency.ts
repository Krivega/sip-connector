import { repeatedCallsAsync } from 'repeated-calls';

const SEND_PRESENTATION_CALL_LIMIT = 1;

const DEFAULT_REPEATED_CALLS_OPTIONS = {
  callLimit: SEND_PRESENTATION_CALL_LIMIT,
};

export class PresentationConcurrency {
  private promisePendingStart?: Promise<MediaStreamVideoTrack>;

  private promisePendingStop?: Promise<MediaStreamVideoTrack | undefined>;

  private cancelableSendPresentation?:
    ReturnType<typeof repeatedCallsAsync<MediaStreamVideoTrack>> | undefined;

  private startAbortController?: AbortController;

  public get isStartPending(): boolean {
    return this.startAbortController !== undefined || this.promisePendingStart !== undefined;
  }

  public get isPending(): boolean {
    return this.isStartPending || this.promisePendingStop !== undefined;
  }

  public cancel(): void {
    this.startAbortController?.abort();
    this.cancelableSendPresentation?.stopRepeatedCalls();

    if (!this.promisePendingStart) {
      // Между попытками stopRepeatedCalls снимает таймер, но не завершает промис.
      this.cancelableSendPresentation?.cancel();
    }
  }

  public async runWithRepeatedCalls(
    targetFunction: (signal: AbortSignal) => Promise<MediaStreamVideoTrack>,
    isComplete: () => boolean,
    options: { callLimit: number } = DEFAULT_REPEATED_CALLS_OPTIONS,
  ): Promise<MediaStreamVideoTrack> {
    const startAbortController = new AbortController();

    this.startAbortController = startAbortController;
    this.cancelableSendPresentation = repeatedCallsAsync<MediaStreamVideoTrack>({
      // stopRepeatedCalls не прерывает уже идущую попытку: её останавливает сигнал
      targetFunction: async () => {
        return this.runStart(async () => {
          return targetFunction(startAbortController.signal);
        });
      },
      isComplete,
      isRejectAsValid: true,
      ...options,
    });

    return this.cancelableSendPresentation
      .then((response?: unknown) => {
        return response as MediaStreamVideoTrack;
      })
      .finally(() => {
        if (this.startAbortController === startAbortController) {
          this.cancelableSendPresentation = undefined;
          this.startAbortController = undefined;
        }
      });
  }

  public async runStart(
    operation: () => Promise<MediaStreamVideoTrack>,
  ): Promise<MediaStreamVideoTrack> {
    const result = operation();

    this.promisePendingStart = result;

    return result.finally(() => {
      if (this.promisePendingStart === result) {
        this.promisePendingStart = undefined;
      }
    });
  }

  public async awaitPendingStart(): Promise<void> {
    await (this.cancelableSendPresentation ?? this.promisePendingStart)?.catch(() => {});
  }

  public async runStop(
    operation: () => Promise<MediaStreamVideoTrack | undefined>,
  ): Promise<MediaStreamVideoTrack | undefined> {
    const result = (async () => {
      await this.awaitPendingStart();

      return operation();
    })();

    this.promisePendingStop = result;

    return result.finally(() => {
      if (this.promisePendingStop === result) {
        this.promisePendingStop = undefined;
      }
    });
  }

  public clearPending(): void {
    this.startAbortController = undefined;
    this.cancelableSendPresentation = undefined;
    this.promisePendingStart = undefined;
    this.promisePendingStop = undefined;
  }

  public reset(): void {
    this.cancel();
    this.clearPending();
  }
}
