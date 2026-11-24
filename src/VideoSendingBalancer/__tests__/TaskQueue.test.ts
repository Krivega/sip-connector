import flushPromises from '@/__fixtures__/flushPromises';
import { TaskQueue } from '../TaskQueue';

describe('TaskQueue', () => {
  let taskQueue: TaskQueue;
  let key: object;
  let log: string[];

  const createLoggedTask = (name: string) => {
    return async () => {
      log.push(`${name}:start`);
      await flushPromises();
      log.push(`${name}:end`);

      return name;
    };
  };

  beforeEach(() => {
    taskQueue = new TaskQueue();
    key = {};
    log = [];
  });

  it('должен вернуть результат задачи', async () => {
    const result = await taskQueue.add(key, async () => {
      return 'result';
    });

    expect(result).toBe('result');
  });

  it('должен отклониться ошибкой задачи', async () => {
    const error = new Error('task failed');

    await expect(
      taskQueue.add(key, async () => {
        throw error;
      }),
    ).rejects.toBe(error);
  });

  it('должен выполнять задачи по одной в порядке добавления и вернуть каждой её результат', async () => {
    const results = await Promise.all([
      taskQueue.add(key, createLoggedTask('first')),
      taskQueue.add(key, createLoggedTask('second')),
      taskQueue.add(key, createLoggedTask('third')),
    ]);

    expect(results).toEqual(['first', 'second', 'third']);
    expect(log).toEqual([
      'first:start',
      'first:end',
      'second:start',
      'second:end',
      'third:start',
      'third:end',
    ]);
  });

  it('должен запустить задачу только после завершения предыдущей', async () => {
    const previous = Promise.withResolvers<string>();
    const nextTask = jest.fn(createLoggedTask('next'));

    const previousResult = taskQueue.add(key, async () => {
      return previous.promise;
    });
    const nextResult = taskQueue.add(key, nextTask);

    await flushPromises();

    expect(nextTask).not.toHaveBeenCalled();

    previous.resolve('previous');

    await expect(previousResult).resolves.toBe('previous');
    await expect(nextResult).resolves.toBe('next');
  });

  it('должен запустить следующую задачу после завершения предыдущей ошибкой', async () => {
    const error = new Error('previous failed');
    const previous = Promise.withResolvers<string>();
    const nextTask = jest.fn(createLoggedTask('next'));

    const previousResult = taskQueue.add(key, async () => {
      return previous.promise;
    });
    const nextResult = taskQueue.add(key, nextTask);

    await flushPromises();

    expect(nextTask).not.toHaveBeenCalled();

    previous.reject(error);

    await expect(previousResult).rejects.toBe(error);
    await expect(nextResult).resolves.toBe('next');
  });

  it('должен выполнить задачу, добавленную из выполняющейся задачи, после её завершения', async () => {
    let nestedResult: Promise<string> | undefined;

    await taskQueue.add(key, async () => {
      log.push('outer:start');
      nestedResult = taskQueue.add(key, createLoggedTask('nested'));
      await flushPromises();
      log.push('outer:end');
    });
    await nestedResult;

    expect(log).toEqual(['outer:start', 'outer:end', 'nested:start', 'nested:end']);
  });

  describe('очереди разных ключей', () => {
    let otherKey: object;
    let unfinished: PromiseWithResolvers<string>;
    let unfinishedResult: Promise<string>;

    beforeEach(async () => {
      otherKey = {};
      unfinished = Promise.withResolvers<string>();
      unfinishedResult = taskQueue.add(key, async () => {
        return unfinished.promise;
      });
      await flushPromises();
    });

    it('должен выполнить задачу другого ключа, не дожидаясь незавершённой задачи первого', async () => {
      await expect(taskQueue.add(otherKey, createLoggedTask('other'))).resolves.toBe('other');

      unfinished.resolve('unfinished');

      await expect(unfinishedResult).resolves.toBe('unfinished');
    });

    it('должен запустить задачу того же ключа только после незавершённой, даже если задача другого ключа уже выполнена', async () => {
      const queuedResult = taskQueue.add(key, createLoggedTask('queued'));

      await taskQueue.add(otherKey, createLoggedTask('other'));

      expect(log).toEqual(['other:start', 'other:end']);

      unfinished.resolve('unfinished');

      await expect(queuedResult).resolves.toBe('queued');
      expect(log).toEqual(['other:start', 'other:end', 'queued:start', 'queued:end']);
    });
  });
});
