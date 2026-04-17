type TCallbacks = Record<string, Set<(payload?: unknown) => void>>;

/**
 * Фейковый ConnectionManager: только нужные события и getUaProtected/getUri.
 */
export class FakeConnectionManager {
  public isRegistered = true;

  public readonly handlers: TCallbacks = {
    connected: new Set(),
    registered: new Set(),
    disconnected: new Set(),
  };

  public readonly ua = { tag: 'ua' } as const;

  public on = (event: string, handler: (payload?: unknown) => void): (() => void) => {
    const bucket = this.getBucket(event);

    bucket.add(handler);

    return () => {
      bucket.delete(handler);
    };
  };

  public off = (event: string, handler: (payload?: unknown) => void): void => {
    this.getBucket(event).delete(handler);
  };

  public emit = (event: string): void => {
    this.getBucket(event).forEach((handler) => {
      handler();
    });
  };

  public getUaProtected = (): unknown => {
    return this.ua;
  };

  public getUri = (identifier: string): string => {
    return `sip:${identifier}@${this.ua.tag}.example`;
  };

  private getBucket(event: string): Set<(payload?: unknown) => void> {
    let bucket = this.handlers[event] as Set<(payload?: unknown) => void> | undefined;

    if (bucket === undefined) {
      bucket = new Set();
      this.handlers[event] = bucket;
    }

    return bucket;
  }
}
