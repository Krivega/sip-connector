import type { ITaskQueue } from './types';

/**
 * Строго последовательная очередь задач
 * Ошибка задачи отклоняет только её промис и не останавливает очередь
 * shortcut: зависший setParameters или replaceTrack держит очередь до остановки балансировки; таймаут сознательно не делается
 */
export class TaskQueue implements ITaskQueue {
  private lastTask: Promise<unknown> = Promise.resolve();

  /**
   * Добавляет задачу в очередь и возвращает Promise с результатом
   * @param task - Функция для выполнения
   * @returns Promise с результатом выполнения задачи
   */
  public async add<T>(task: () => Promise<T>): Promise<T> {
    const result = this.lastTask.then(async () => {
      return task();
    });

    this.lastTask = result.catch(() => {
      return undefined;
    });

    return result;
  }

  /**
   * Начинает очередь заново: задачи прежней цепочки дорабатывают сами, новые их не ждут
   */
  public reset(): void {
    this.lastTask = Promise.resolve();
  }
}
