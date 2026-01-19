import type { TRemoteStreams } from './types';

/**
 * Сравнивает два объекта TRemoteStreams на равенство по ID потоков
 * @param streams1 - Первый объект streams для сравнения
 * @param streams2 - Второй объект streams для сравнения
 * @returns true, если streams равны (имеют одинаковые ID mainStream и contentedStream)
 */
export const hasStreamsEqual = (streams1?: TRemoteStreams, streams2?: TRemoteStreams): boolean => {
  if (!streams1 || !streams2) {
    return streams1 === streams2;
  }

  const mainStreamId1 = streams1.mainStream?.id;
  const mainStreamId2 = streams2.mainStream?.id;
  const contentedStreamId1 = streams1.contentedStream?.id;
  const contentedStreamId2 = streams2.contentedStream?.id;

  return mainStreamId1 === mainStreamId2 && contentedStreamId1 === contentedStreamId2;
};

/**
 * Класс для отслеживания изменений удаленных streams
 * Хранит последнее состояние streams и определяет, изменились ли они
 */
export class StreamsChangeTracker {
  private lastEmittedStreams?: TRemoteStreams;

  /**
   * Проверяет, изменились ли streams с последнего сохраненного состояния
   * @param streams - Текущие streams для проверки
   * @returns true, если streams изменились
   */
  public hasChanged(streams: TRemoteStreams): boolean {
    return !hasStreamsEqual(this.lastEmittedStreams, streams);
  }

  /**
   * Сохраняет текущие streams как последнее эмитнутое состояние
   * @param streams - Streams для сохранения
   */
  public updateLastEmittedStreams(streams: TRemoteStreams): void {
    this.lastEmittedStreams = streams;
  }

  /**
   * Получает последние эмитнутые streams
   * @returns Последние сохраненные streams или undefined
   */
  public getLastEmittedStreams(): TRemoteStreams | undefined {
    return this.lastEmittedStreams;
  }

  /**
   * Сбрасывает состояние трекера
   */
  public reset(): void {
    this.lastEmittedStreams = undefined;
  }
}
