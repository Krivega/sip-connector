import delayPromise from '@/__fixtures__/delayPromise';
import flushPromises from '@/__fixtures__/flushPromises';
import { TaskQueue } from '../TaskQueue';

describe('TaskQueue', () => {
  let taskQueue: TaskQueue;
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
    log = [];
  });

  it('должен вернуть результат задачи', async () => {
    const result = await taskQueue.add(async () => {
      return 'result';
    });

    expect(result).toBe('result');
  });

  it('должен отклониться ошибкой задачи', async () => {
    const error = new Error('task failed');

    await expect(
      taskQueue.add(async () => {
        throw error;
      }),
    ).rejects.toBe(error);
  });

  it('должен выполнять задачи по одной в порядке добавления и вернуть каждой её результат', async () => {
    const results = await Promise.all([
      taskQueue.add(createLoggedTask('first')),
      taskQueue.add(createLoggedTask('second')),
      taskQueue.add(createLoggedTask('third')),
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

    const previousResult = taskQueue.add(async () => {
      return previous.promise;
    });
    const nextResult = taskQueue.add(nextTask);

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

    const previousResult = taskQueue.add(async () => {
      return previous.promise;
    });
    const nextResult = taskQueue.add(nextTask);

    await flushPromises();

    expect(nextTask).not.toHaveBeenCalled();

    previous.reject(error);

    await expect(previousResult).rejects.toBe(error);
    await expect(nextResult).resolves.toBe('next');
  });

  it('должен выполнить задачу, добавленную из выполняющейся задачи, после её завершения', async () => {
    let nestedResult: Promise<string> | undefined;

    await taskQueue.add(async () => {
      log.push('outer:start');
      nestedResult = taskQueue.add(createLoggedTask('nested'));
      await flushPromises();
      log.push('outer:end');
    });
    await nestedResult;

    expect(log).toEqual(['outer:start', 'outer:end', 'nested:start', 'nested:end']);
  });

  describe('reset', () => {
    let unfinished: PromiseWithResolvers<string>;
    let unfinishedResult: Promise<string>;

    beforeEach(async () => {
      unfinished = Promise.withResolvers<string>();
      unfinishedResult = taskQueue.add(async () => {
        return unfinished.promise;
      });
      await flushPromises();
    });

    it('должен запустить задачу, добавленную после reset, не дожидаясь незавершённой задачи прежней цепочки', async () => {
      const nextTask = jest.fn(createLoggedTask('next'));

      taskQueue.reset();

      const nextResult = taskQueue.add(nextTask);

      await flushPromises();

      expect(nextTask).toHaveBeenCalledTimes(1);

      unfinished.resolve('unfinished');

      await expect(nextResult).resolves.toBe('next');
    });

    it('должен довести до конца задачи прежней цепочки и вернуть каждой её результат после reset', async () => {
      const queuedResult = taskQueue.add(createLoggedTask('queued'));

      taskQueue.reset();
      unfinished.resolve('unfinished');

      await expect(unfinishedResult).resolves.toBe('unfinished');
      await expect(queuedResult).resolves.toBe('queued');
    });

    it('должен выполнять задачи, добавленные после reset, по одной в порядке добавления', async () => {
      taskQueue.reset();
      taskQueue.add(createLoggedTask('first')).catch(() => {});
      taskQueue.add(createLoggedTask('second')).catch(() => {});
      await delayPromise(0);

      expect(log).toEqual(['first:start', 'first:end', 'second:start', 'second:end']);
    });
  });
});
