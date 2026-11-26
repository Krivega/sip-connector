import type { ITaskQueue } from './types';

/**
 * Строго последовательные очереди задач: у каждого ключа (отправителя) своя
 * Ошибка задачи отклоняет только её промис и не останавливает очередь
 * shortcut: таймаута у очереди нет — зависший setParameters или replaceTrack держит очередь своего отправителя насовсем (у следующего звонка свой отправитель и своя очередь), а с ней и сверку по тику текущего запуска
 * Не дольше таймаута зависшую задачу ждёт только замена трека: TrackReplacer вызывает мимо очереди лишь оригинальный replaceTrack
 */
export class TaskQueue implements ITaskQueue {
  private readonly lastTasks = new WeakMap<object, Promise<unknown>>();

  /**
   * Добавляет задачу в очередь ключа и возвращает Promise с результатом
   * @param key - Владелец очереди: задачи одного ключа выполняются в порядке добавления
   * @param task - Функция для выполнения
   * @returns Promise с результатом выполнения задачи
   */
  public async add<T>(key: object, task: () => Promise<T>): Promise<T> {
    const result = (this.lastTasks.get(key) ?? Promise.resolve()).then(async () => {
      return task();
    });

    this.lastTasks.set(
      key,
      result.catch(() => {
        return undefined;
      }),
    );

    return result;
  }
}
