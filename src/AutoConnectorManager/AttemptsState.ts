import { EEvent } from './eventNames';

import type { TEvents } from './eventNames';

const DEFAULT_INITIAL_COUNT = 0;
const DEFAULT_LIMIT = 30;

class AttemptsState {
  private readonly events: TEvents;

  private countInner = DEFAULT_INITIAL_COUNT;

  private readonly initialCount = DEFAULT_INITIAL_COUNT;

  private readonly limitInner = DEFAULT_LIMIT;

  private isInProgress = false;

  public constructor({ events }: { events: TEvents }) {
    this.events = events;
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
    this.events.trigger(EEvent.CHANGED_ATTEMPT_STATUS, { isInProgress: this.isInProgress });
  }
}

export default AttemptsState;
