import flushPromises from '@/__fixtures__/flushPromises';
import { KeyedSignal } from '../KeyedSignal';

describe('KeyedSignal', () => {
  let keyedSignal: KeyedSignal;
  let key: object;
  let otherKey: object;

  // разрешился ли промис к моменту проверки
  const observeResolution = (promise: Promise<void>) => {
    const resolution = { isResolved: false };

    promise.then(
      () => {
        resolution.isResolved = true;
      },
      () => {},
    );

    return resolution;
  };

  beforeEach(() => {
    keyedSignal = new KeyedSignal();
    key = {};
    otherKey = {};
  });

  it('должен разрешить ожидание ключа только по notify этого ключа', async () => {
    const waiting = observeResolution(keyedSignal.next(key));

    await flushPromises();

    expect(waiting.isResolved).toBe(false);

    keyedSignal.notify(key);
    await flushPromises();

    expect(waiting.isResolved).toBe(true);
  });

  it('должен одним notify разрешить все ожидания ключа, начатые до него', async () => {
    const firstWaiting = observeResolution(keyedSignal.next(key));
    const secondWaiting = observeResolution(keyedSignal.next(key));

    keyedSignal.notify(key);
    await flushPromises();

    expect(firstWaiting.isResolved).toBe(true);
    expect(secondWaiting.isResolved).toBe(true);
  });

  it('не должен разрешать ожидание ключа notify другого ключа', async () => {
    const waiting = observeResolution(keyedSignal.next(key));
    const otherWaiting = observeResolution(keyedSignal.next(otherKey));

    keyedSignal.notify(otherKey);
    await flushPromises();

    expect(waiting.isResolved).toBe(false);
    expect(otherWaiting.isResolved).toBe(true);
  });

  it('должен разрешить ожидание, начатое после notify, только следующим notify', async () => {
    keyedSignal.notify(key);

    const waitingAfterNotifyWithoutWaiters = observeResolution(keyedSignal.next(key));

    await flushPromises();

    expect(waitingAfterNotifyWithoutWaiters.isResolved).toBe(false);

    keyedSignal.notify(key);

    const waitingAfterNotify = observeResolution(keyedSignal.next(key));

    await flushPromises();

    expect(waitingAfterNotifyWithoutWaiters.isResolved).toBe(true);
    expect(waitingAfterNotify.isResolved).toBe(false);

    keyedSignal.notify(key);
    await flushPromises();

    expect(waitingAfterNotify.isResolved).toBe(true);
  });
});
