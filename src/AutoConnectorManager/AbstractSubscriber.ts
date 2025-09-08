import type { ISubscriber } from './types';

abstract class AbstractSubscriber<T = void> implements ISubscriber<T> {
  protected disposer?: () => void;

  public unsubscribe() {
    this.disposer?.();
    this.disposer = undefined;
  }

  public abstract subscribe(callback: (value: T) => void): void;
}

export default AbstractSubscriber;
