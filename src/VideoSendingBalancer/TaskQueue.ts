import { createStackPromises } from 'stack-promises';

import logger from '@/logger';

import type { ITaskQueue } from './types';

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
    return this.stackPromises().catch((error: unknown) => {
      logger('TaskQueue: error', error);
    });
  }
}
