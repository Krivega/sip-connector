type TSignal = { promise: Promise<void>; resolve: () => void };

// промис и функция, которая его разрешает
export const createSignal = (): TSignal => {
  // присваивается синхронно в исполнителе промиса
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

/**
 * Сигнал по ключу: next ждёт ближайшего notify этого ключа, notify отпускает всех, кто ждал его к этому моменту.
 * Ждущие одного ключа делят один промис, и notify снимает его; ключи хранятся в WeakMap и не удерживаются
 */
export class KeyedSignal {
  private readonly signals = new WeakMap<object, TSignal>();

  /**
   * @param key - Ключ сигнала
   * @returns Promise, который разрешается ближайшим notify этого ключа
   */
  public async next(key: object): Promise<void> {
    let signal = this.signals.get(key);

    if (!signal) {
      signal = createSignal();
      this.signals.set(key, signal);
    }

    return signal.promise;
  }

  public notify(key: object): void {
    const signal = this.signals.get(key);

    this.signals.delete(key);
    signal?.resolve();
  }
}
