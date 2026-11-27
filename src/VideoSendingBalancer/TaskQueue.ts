import { KeyedSignal } from './KeyedSignal';

import type { ITaskQueue } from './types';

/**
 * Строго последовательные очереди задач: у каждого ключа (отправителя) своя
 * Ошибка задачи отклоняет только её промис и не останавливает очередь
 * shortcut: таймаута у очереди нет — зависший setParameters или replaceTrack держит очередь своего отправителя насовсем (у следующего звонка свой отправитель и своя очередь), а с ней и сверку по тику текущего запуска
 * Таймаут есть только у ожидания вызывающего замены трека: если BROWSER_RESPONSE_TIMEOUT_MS подряд не завершилась ни одна задача очереди отправителя (nextSettled) и ни одна запись замены, TrackReplacer вызывает мимо очереди лишь оригинальный replaceTrack
 */
export class TaskQueue implements ITaskQueue {
  private readonly lastTasks = new WeakMap<object, Promise<unknown>>();

  private readonly taskSettled = new KeyedSignal();

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
    const notifySettled = () => {
      this.taskSettled.notify(key);
    };

    this.lastTasks.set(key, result.then(notifySettled, notifySettled));

    return result;
  }

  /**
   * Ждёт завершения очередной задачи ключа
   * @param key - Владелец очереди
   * @returns Promise, который разрешается, когда после вызова завершится, успехом или ошибкой, любая задача ключа
   */
  public async nextSettled(key: object): Promise<void> {
    return this.taskSettled.next(key);
  }
}
