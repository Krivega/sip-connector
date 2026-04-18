/* eslint-disable @typescript-eslint/no-explicit-any */

type TCallbacks = Record<string, Set<(payload?: unknown) => void>>;

/**
 * Фейковый CallManager: минимум, необходимый для интеграционных тестов `CallReconnectManager`.
 */
export class FakeCallManager {
  public readonly handlers: TCallbacks = {
    failed: new Set(),
    'end-call': new Set(),
    ended: new Set(),
  };

  public startCall = jest.fn(async (..._arguments: any[]) => {
    return undefined;
  });

  private isSpectatorInner = false;

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

  public emit = (event: string, payload?: unknown): void => {
    this.getBucket(event).forEach((handler) => {
      handler(payload);
    });
  };

  public hasSpectator = (): boolean => {
    return this.isSpectatorInner;
  };

  public setSpectator = (value: boolean): void => {
    this.isSpectatorInner = value;
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
