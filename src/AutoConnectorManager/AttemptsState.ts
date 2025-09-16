const DEFAULT_INITIAL_COUNT = 0;
const DEFAULT_LIMIT = 30;

class AttemptsState {
  private countInner = DEFAULT_INITIAL_COUNT;

  private readonly initialCount = DEFAULT_INITIAL_COUNT;

  private readonly limitInner = DEFAULT_LIMIT;

  private inProgress = false;

  private readonly onStatusChange: (inProgress: boolean) => void;

  public constructor({ onStatusChange }: { onStatusChange: (inProgress: boolean) => void }) {
    this.onStatusChange = onStatusChange;
  }

  public get count(): number {
    return this.countInner;
  }

  public get limit(): number {
    return this.limitInner;
  }

  public get isAttemptInProgress(): boolean {
    return this.inProgress;
  }

  public hasLimitReached(): boolean {
    return this.countInner >= this.limitInner;
  }

  public startAttempt(): void {
    if (!this.inProgress) {
      this.inProgress = true;
      this.onStatusChange(this.inProgress);
    }
  }

  public finishAttempt(): void {
    if (this.inProgress) {
      this.inProgress = false;
      this.onStatusChange(this.inProgress);
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
}

export default AttemptsState;
