/// <reference types="jest" />
import { isEmptyStackError } from 'stack-promises';

import logger from '@/logger';
import { TaskQueue } from '../TaskQueue';

jest.mock('@/logger');

const { mcuDebugLogger } = logger as jest.Mock & { mcuDebugLogger: jest.Mock };

describe('TaskQueue', () => {
  let taskQueue: TaskQueue<void>;

  beforeEach(() => {
    taskQueue = new TaskQueue();
  });

  describe('add', () => {
    it('должен выполнить задачу', async () => {
      const task = jest.fn(async () => {});

      await taskQueue.add(task);

      expect(task).toHaveBeenCalledTimes(1);
    });

    it('должен выполнить несколько задач', async () => {
      const task1 = jest.fn(async () => {});
      const task2 = jest.fn(async () => {});
      const task3 = jest.fn(async () => {});

      await taskQueue.add(task1);
      await taskQueue.add(task2);
      await taskQueue.add(task3);

      expect(task1).toHaveBeenCalledTimes(1);
      expect(task2).toHaveBeenCalledTimes(1);
      expect(task3).toHaveBeenCalledTimes(1);
    });

    it('должен обработать ошибку в задаче', async () => {
      const error = new Error('Task failed');
      const task = jest.fn().mockRejectedValue(error);

      await taskQueue.add(task);

      expect(task).toHaveBeenCalledTimes(1);
    });

    it('должен обработать ошибку и продолжить выполнение следующих задач', async () => {
      const error = new Error('Task failed');
      const failingTask = jest.fn().mockRejectedValue(error);
      const succeedingTask = jest.fn(async () => {});

      await taskQueue.add(failingTask);
      await taskQueue.add(succeedingTask);

      expect(failingTask).toHaveBeenCalledTimes(1);
      expect(succeedingTask).toHaveBeenCalledTimes(1);
    });

    it('должен выполнить задачи с задержкой', async () => {
      const task1 = jest.fn().mockImplementation(async () => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            resolve();
          }, 12);
        });
      });
      const task2 = jest.fn(async () => {});

      const startTime = Date.now();

      await taskQueue.add(task1);
      await taskQueue.add(task2);

      const endTime = Date.now();

      expect(task1).toHaveBeenCalledTimes(1);
      expect(task2).toHaveBeenCalledTimes(1);
      expect(endTime - startTime).toBeGreaterThanOrEqual(10);
    });
  });

  describe('stop', () => {
    it('должен остановить очередь задач', async () => {
      const task1 = jest.fn(async () => {});
      const task2 = jest.fn(async () => {});
      const task3 = jest.fn(async () => {});

      // Добавляем задачи в очередь
      const promise1 = taskQueue.add(task1);
      const promise2 = taskQueue.add(task2);

      // Останавливаем очередь после добавления задач
      taskQueue.stop();

      // Пытаемся добавить еще одну задачу после остановки
      const promise3 = taskQueue.add(task3);

      // Ждем завершения всех промисов
      const results = await Promise.allSettled([promise1, promise2, promise3]);

      // Проверяем, что задачи не выполнились (stop() предотвращает выполнение уже добавленных задач)
      expect(task1).not.toHaveBeenCalled();
      expect(task2).not.toHaveBeenCalled();

      // Проверяем, что задача выполнилась, так как она добавлена после остановки
      expect(task3).toHaveBeenCalled();

      // Проверяем, что все промисы завершились успешно
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled');
      expect(results[2].status).toBe('fulfilled');
    });

    it('должен позволить остановить очередь несколько раз', () => {
      expect(() => {
        taskQueue.stop();
        taskQueue.stop();
        taskQueue.stop();
      }).not.toThrow();
    });
  });

  describe('с разными типами данных', () => {
    it('должен работать с задачами, возвращающими числа', async () => {
      const task = jest.fn().mockImplementation(async () => {
        return 42;
      });

      await taskQueue.add(task);

      expect(task).toHaveBeenCalledTimes(1);
    });

    it('должен работать с задачами, возвращающими объекты', async () => {
      const task = jest.fn().mockImplementation(async () => {
        return { id: 1, name: 'test' };
      });

      await taskQueue.add(task);

      expect(task).toHaveBeenCalledTimes(1);
    });

    it('должен работать с задачами, не возвращающими значения', async () => {
      const task = jest.fn(async () => {});

      await taskQueue.add(task);

      expect(task).toHaveBeenCalledTimes(1);
    });
  });

  describe('возвращаемые значения', () => {
    it('должен возвращать число из задачи', async () => {
      const taskQueueItem = new TaskQueue<number>();
      const task = jest.fn().mockImplementation(async () => {
        return 42;
      });

      const result = await taskQueueItem.add(task);

      expect(result).toBe(42);
    });

    it('должен возвращать объект из задачи', async () => {
      const taskQueueItem = new TaskQueue<{ id: number; name: string }>();
      const task = jest.fn().mockImplementation(async () => {
        return { id: 1, name: 'test' };
      });

      const result = await taskQueueItem.add(task);

      expect(result).toEqual({ id: 1, name: 'test' });
    });

    it('должен возвращать undefined из задачи без возвращаемого значения', async () => {
      const taskQueueItem = new TaskQueue<void>();
      const task = jest.fn(async () => {});

      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      const result = await taskQueueItem.add(task);

      expect(result).toBeUndefined();
    });

    it('должен возвращать строку из задачи', async () => {
      const taskQueueItem = new TaskQueue<string>();
      const task = jest.fn().mockImplementation(async () => {
        return 'test result';
      });

      const result = await taskQueueItem.add(task);

      expect(result).toBe('test result');
    });

    it('должен возвращать массив из задачи', async () => {
      const taskQueueItem = new TaskQueue<(number | string)[]>();
      const task = jest.fn().mockImplementation(async () => {
        return [1, 2, 3, 'test'];
      });

      const result = await taskQueueItem.add(task);

      expect(result).toEqual([1, 2, 3, 'test']);
    });

    it('должен возвращать boolean из задачи', async () => {
      const taskQueueItem = new TaskQueue<boolean>();
      const task = jest.fn().mockImplementation(async () => {
        return true;
      });

      const result = await taskQueueItem.add(task);

      expect(result).toBe(true);
    });

    it('должен возвращать undefined из задачи, явно возвращающей undefined', async () => {
      const taskQueueItem = new TaskQueue<undefined>();
      const task = jest.fn().mockImplementation(async () => {
        return undefined;
      });

      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      const result = await taskQueueItem.add(task);

      expect(result).toBeUndefined();
    });

    it('должен возвращать результат из нескольких последовательных задач', async () => {
      const taskQueueItem = new TaskQueue<string>();
      const task1 = jest.fn().mockImplementation(async () => {
        return 'first';
      });
      const task2 = jest.fn().mockImplementation(async () => {
        return 'second';
      });
      const task3 = jest.fn().mockImplementation(async () => {
        return 'third';
      });

      const result1 = await taskQueueItem.add(task1);
      const result2 = await taskQueueItem.add(task2);
      const result3 = await taskQueueItem.add(task3);

      expect(result1).toBe('first');
      expect(result2).toBe('second');
      expect(result3).toBe('third');
    });
  });

  describe('очередь при добавлении задач во время выполнения', () => {
    let numberQueue: TaskQueue<number>;
    let order: string[];
    let firstDeferred: PromiseWithResolvers<number>;
    let firstPromise: Promise<number>;

    beforeEach(async () => {
      numberQueue = new TaskQueue<number>();
      order = [];
      firstDeferred = Promise.withResolvers<number>();
      firstPromise = numberQueue.add(async () => {
        const value = await firstDeferred.promise;

        order.push('first');

        return value;
      });

      await Promise.resolve();
    });

    it('должен резолвить выполняющуюся задачу только после последней задачи её результатом', async () => {
      const lastDeferred = Promise.withResolvers<number>();
      const lastPromise = numberQueue.add(async () => {
        const value = await lastDeferred.promise;

        order.push('last');

        return value;
      });
      const firstResult = firstPromise.then((value) => {
        order.push(`first-resolved:${value}`);
      });

      firstDeferred.resolve(1);
      await Promise.resolve();
      lastDeferred.resolve(2);
      await Promise.all([firstResult, lastPromise]);

      expect(order).toEqual(['first', 'last', 'first-resolved:2']);
    });

    it('не должен запускать вытесненную задачу и должен резолвить её результатом последней', async () => {
      const skippedTask = jest.fn(async () => {
        return 2;
      });
      const skippedPromise = numberQueue.add(skippedTask);
      const lastPromise = numberQueue.add(async () => {
        order.push('last');

        return 3;
      });
      const skippedResult = skippedPromise.then((value) => {
        order.push(`skipped-resolved:${value}`);
      });

      firstDeferred.resolve(1);
      await Promise.all([firstPromise, skippedResult, lastPromise]);

      expect(skippedTask).not.toHaveBeenCalled();
      expect(order).toEqual(['first', 'last', 'skipped-resolved:3']);
      await expect(firstPromise).resolves.toBe(3);
    });

    it('должен резолвить задачи undefined без повторного запуска, если очередь остановлена во время выполнения', async () => {
      const secondTask = jest.fn(async () => {
        return 2;
      });
      const secondPromise = numberQueue.add(secondTask);

      numberQueue.stop();
      firstDeferred.resolve(1);

      const results = await Promise.all([firstPromise, secondPromise]);

      expect(results).toEqual([undefined, undefined]);
      expect(secondTask).not.toHaveBeenCalled();
      expect(order).toEqual(['first']);
      expect(mcuDebugLogger).toHaveBeenCalledWith('TaskQueue: error', expect.any(Error));
      expect(
        mcuDebugLogger.mock.calls.every(([, error]) => {
          return isEmptyStackError(error as Error);
        }),
      ).toBe(true);
    });
  });

  describe('ошибки задач', () => {
    it('должен резолвить undefined и логировать ошибку задачи', async () => {
      const error = new Error('Task failed');
      const numberQueue = new TaskQueue<number>();

      const result = await numberQueue.add(async () => {
        throw error;
      });

      expect(result).toBeUndefined();
      expect(mcuDebugLogger).toHaveBeenCalledWith('TaskQueue: error', error);
    });

    it('должен резолвить undefined, если последняя задача завершилась ошибкой после добавления', async () => {
      const error = new Error('Last task failed');
      const numberQueue = new TaskQueue<number>();
      const firstDeferred = Promise.withResolvers<number>();
      const firstPromise = numberQueue.add(async () => {
        return firstDeferred.promise;
      });

      await Promise.resolve();

      const lastPromise = numberQueue.add(async () => {
        throw error;
      });

      firstDeferred.resolve(1);

      const results = await Promise.all([firstPromise, lastPromise]);

      expect(results).toEqual([undefined, undefined]);
      expect(mcuDebugLogger).toHaveBeenCalledWith('TaskQueue: error', error);
    });
  });
});
