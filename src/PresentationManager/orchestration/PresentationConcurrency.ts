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

  public get isPending(): boolean {
    return !!this.promisePendingStart || !!this.promisePendingStop;
  }

  public cancel(): void {
    this.cancelableSendPresentation?.stopRepeatedCalls();
  }

  public async runWithRepeatedCalls(
    targetFunction: () => Promise<MediaStreamVideoTrack>,
    isComplete: () => boolean,
    options: { callLimit: number } = DEFAULT_REPEATED_CALLS_OPTIONS,
  ): Promise<MediaStreamVideoTrack> {
    this.cancelableSendPresentation = repeatedCallsAsync<MediaStreamVideoTrack>({
      targetFunction,
      isComplete,
      isRejectAsValid: true,
      ...options,
    });
    this.promisePendingStart = this.cancelableSendPresentation as Promise<MediaStreamVideoTrack>;

    return this.cancelableSendPresentation
      .then((response?: unknown) => {
        return response as MediaStreamVideoTrack;
      })
      .finally(() => {
        this.promisePendingStart = undefined;
        this.cancelableSendPresentation = undefined;
      });
  }

  public async runStart(
    operation: () => Promise<MediaStreamVideoTrack>,
  ): Promise<MediaStreamVideoTrack> {
    const result = operation();

    this.promisePendingStart = result;

    return result.finally(() => {
      this.promisePendingStart = undefined;
    });
  }

  public async awaitPendingStart(): Promise<void> {
    if (this.promisePendingStart) {
      await this.promisePendingStart.catch(() => {});
    }
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
      this.promisePendingStop = undefined;
    });
  }

  public clearPending(): void {
    this.promisePendingStart = undefined;
    this.promisePendingStop = undefined;
  }

  public reset(): void {
    this.cancel();
    this.clearPending();
  }
}
