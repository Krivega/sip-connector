import resolveDebug from '@/logger';

const DEFAULT_INITIAL_COUNT = 0;
const DEFAULT_LIMIT = 30;
const debug = resolveDebug('AutoConnectorManager: AttemptsState');

class AttemptsState {
  private countInner = DEFAULT_INITIAL_COUNT;

  private readonly initialCount = DEFAULT_INITIAL_COUNT;

  private readonly limitInner = DEFAULT_LIMIT;

  private isInProgress = false;

  private readonly onStatusChange: ({ isInProgress }: { isInProgress: boolean }) => void;

  public constructor({
    onStatusChange,
  }: {
    onStatusChange: ({ isInProgress }: { isInProgress: boolean }) => void;
  }) {
    this.onStatusChange = onStatusChange;
  }

  public get count(): number {
    return this.countInner;
  }

  public get limit(): number {
    return this.limitInner;
  }

  public get isAttemptInProgress(): boolean {
    return this.isInProgress;
  }

  public hasLimitReached(): boolean {
    debug('hasLimitReached', { count: this.countInner, limit: this.limitInner });

    return this.countInner >= this.limitInner;
  }

  public startAttempt(): void {
    debug('startAttempt', { count: this.countInner, limit: this.limitInner });

    if (!this.isInProgress) {
      this.isInProgress = true;
      this.onStatusChange({ isInProgress: this.isInProgress });
    }
  }

  public finishAttempt(): void {
    debug('finishAttempt', { count: this.countInner, limit: this.limitInner });

    if (this.isInProgress) {
      this.isInProgress = false;
      this.onStatusChange({ isInProgress: this.isInProgress });
    }
  }

  public increment(): void {
    debug('increment', { count: this.countInner, limit: this.limitInner });

    if (this.count < this.limit) {
      this.countInner += 1;
    }
  }

  public reset(): void {
    debug('reset', { count: this.countInner, limit: this.limitInner });

    this.countInner = this.initialCount;
    this.finishAttempt();
  }
}

export default AttemptsState;
