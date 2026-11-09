import { createStackPromises, isPromiseIsNotActualError } from 'stack-promises';

import resolveDebug from '@/logger';

import type { ITaskQueue } from './types';

const debug = resolveDebug('TaskQueue');

/**
 * Очередь задач с правильной обработкой ошибок
 * Обеспечивает последовательное выполнение задач и логирование ошибок
 */
export class TaskQueue<T> implements ITaskQueue<T> {
  private readonly stackPromises = createStackPromises({
    noRunIsNotActual: true,
  });

  /**
   * Добавляет задачу в очередь и возвращает Promise с результатом
   * @param task - Функция для выполнения
   * @returns Promise с результатом выполнения задачи
   */
  public async add(task: () => Promise<T>): Promise<T> {
    this.stackPromises.add(task);

    return this.run();
  }

  public stop(): void {
    this.stackPromises.stop();
  }

  /**
   * Выполняет задачи из очереди с обработкой ошибок
   * @returns Promise с результатом выполнения
   */
  private async run(): Promise<T> {
    // @ts-expect-error
    return this.stackPromises().catch(async (error: unknown) => {
      // «неактуально» получает ждущий, а не задача: пришла задача новее — ждём её результат; выполненные задачи не повторяются
      if (isPromiseIsNotActualError(error)) {
        return this.run();
      }

      debug('TaskQueue: error', error);

      return undefined;
    });
  }
}
