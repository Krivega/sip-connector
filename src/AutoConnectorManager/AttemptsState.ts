const DEFAULT_INITIAL_COUNT = 0;
const DEFAULT_LIMIT = 30;

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
    return this.countInner >= this.limitInner;
  }

  public startAttempt(): void {
    if (!this.isInProgress) {
      this.isInProgress = true;
      this.emitStatusChange();
    }
  }

  public finishAttempt(): void {
    if (this.isInProgress) {
      this.isInProgress = false;
      this.emitStatusChange();
    }
  }

  public increment(): void {
    if (this.count < this.limit) {
      this.countInner += 1;
    }
  }

  public reset(): void {
    this.countInner = this.initialCount;
    this.finishAttempt();
  }

  private emitStatusChange() {
    this.onStatusChange({ isInProgress: this.isInProgress });
  }
}

export default AttemptsState;
