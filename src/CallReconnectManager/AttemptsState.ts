const DEFAULT_INITIAL_COUNT = 0;
const UNLIMITED = 0;

type TAttemptsStateParameters = {
  limit: number;
  onStatusChange: ({ isInProgress }: { isInProgress: boolean }) => void;
};

/**
 * Состояние счётчика попыток редиала.
 *
 * Инварианты:
 * - счётчик монотонно растёт от 0 до `limit` (или без ограничений при `limit === 0`);
 * - `isInProgress` отражает активную попытку и эмитит изменения только при реальных переходах,
 *   чтобы наружу уходил корректный `status-changed`.
 */
class AttemptsState {
  private countInner = DEFAULT_INITIAL_COUNT;

  private readonly initialCount = DEFAULT_INITIAL_COUNT;

  private readonly limitInner: number;

  private isInProgress = false;

  private readonly onStatusChange: ({ isInProgress }: { isInProgress: boolean }) => void;

  public constructor(parameters: TAttemptsStateParameters) {
    this.limitInner = parameters.limit;
    this.onStatusChange = parameters.onStatusChange;
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
    if (this.limitInner === UNLIMITED) {
      return false;
    }

    return this.countInner >= this.limitInner;
  }

  public startAttempt(): void {
    if (!this.isInProgress) {
      this.isInProgress = true;
      this.onStatusChange({ isInProgress: this.isInProgress });
    }
  }

  public finishAttempt(): void {
    if (this.isInProgress) {
      this.isInProgress = false;
      this.onStatusChange({ isInProgress: this.isInProgress });
    }
  }

  public increment(): void {
    this.countInner += 1;
  }

  public reset(): void {
    this.countInner = this.initialCount;
    this.finishAttempt();
  }
}

export default AttemptsState;
