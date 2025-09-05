class Counter {
  private countInner: number;

  private readonly initialCount: number;

  private readonly limitInner: number;

  public constructor({
    count,
    initialCount,
    limit,
  }: {
    count: number;
    initialCount: number;
    limit: number;
  }) {
    this.countInner = count;
    this.initialCount = initialCount;
    this.limitInner = limit;
  }

  public get count(): number {
    return this.countInner;
  }

  public get limit(): number {
    return this.limitInner;
  }

  public hasLimitReached(): boolean {
    return this.count >= this.limit;
  }

  public increment() {
    if (this.count < this.limit) {
      this.countInner += 1;
    }
  }

  public reset() {
    this.countInner = this.initialCount;
  }
}

export default Counter;
