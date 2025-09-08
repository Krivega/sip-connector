const DEFAULT_INITIAL_COUNT = 0;
const DEFAULT_LIMIT = 30;

class AttemptsState {
  private countInner = DEFAULT_INITIAL_COUNT;

  private readonly initialCount = DEFAULT_INITIAL_COUNT;

  private readonly limitInner = DEFAULT_LIMIT;

  private inProgress = false;

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
    this.inProgress = true;
  }

  public finishAttempt(): void {
    this.inProgress = false;
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
