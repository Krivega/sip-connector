import VideoPlayer from './VideoPlayer';

/**
 * Интерфейс для хранения информации о стриме и его плеере
 */
interface IStreamInfo {
  stream: MediaStream;
  videoPlayer: VideoPlayer;
  container: HTMLElement;
  label: HTMLElement;
}

/**
 * Создает контейнер для стрима
 */
const createStreamContainer = (streamId: string): HTMLElement => {
  const container = document.createElement('div');

  container.className = 'remote-stream-container';
  container.dataset.streamId = streamId;

  return container;
};

/**
 * Создает подпись для стрима
 */
const createStreamLabel = (label: string): HTMLElement => {
  const labelElement = document.createElement('div');

  labelElement.className = 'remote-stream-label';
  labelElement.textContent = label;

  return labelElement;
};

/**
 * Создает video элемент для стрима
 */
const createVideoElement = (streamId: string): HTMLVideoElement => {
  const video = document.createElement('video');

  video.id = streamId;
  video.autoplay = true;
  video.playsInline = true;
  video.muted = false;
  video.controls = true;

  return video;
};

/**
 * Класс для управления удаленными медиа-стримами
 * Хранит стримы и рендерит их в отдельные видео-плееры
 */
class RemoteMediaStreamManager {
  private readonly streams = new Map<string, IStreamInfo>();

  private readonly container: HTMLElement;

  /**
   * Создает экземпляр RemoteMediaStreamManager
   * @param containerId - ID контейнера для размещения видео-плееров
   */
  public constructor(containerId: string) {
    const containerElement = document.querySelector<HTMLElement>(`#${containerId}`);

    if (!containerElement) {
      throw new Error(`Container with id "${containerId}" not found`);
    }

    this.container = containerElement;
  }

  /**
   * Добавляет стрим и создает для него видео-плеер
   * @param streamId - Уникальный идентификатор стрима
   * @param stream - MediaStream для отображения
   * @param label - Подпись для стрима (опционально)
   */
  public addStream(streamId: string, stream: MediaStream): void {
    if (this.streams.has(streamId)) {
      this.removeStream(streamId);
    }

    const label = stream.getVideoTracks()[0]?.label ?? streamId;

    const container = createStreamContainer(streamId);
    const videoElement = createVideoElement(streamId);
    const labelElement = createStreamLabel(label);

    container.append(videoElement);
    container.append(labelElement);
    this.container.append(container);

    const videoPlayer = new VideoPlayer(videoElement);

    videoPlayer.setStream(stream);
    videoPlayer.setPlaying(true);

    this.streams.set(streamId, {
      stream,
      videoPlayer,
      container,
      label: labelElement,
    });
  }

  /**
   * Обновляет подпись стрима
   */
  public setStreamLabel(streamId: string, label: string): void {
    const streamInfo = this.streams.get(streamId);

    if (streamInfo) {
      streamInfo.label.textContent = label;
    }
  }

  /**
   * Удаляет стрим и его видео-плеер
   */
  public removeStream(streamId: string): void {
    const streamInfo = this.streams.get(streamId);

    if (streamInfo) {
      streamInfo.videoPlayer.clear();
      streamInfo.container.remove();
      this.streams.delete(streamId);
    }
  }

  /**
   * Получает стрим по идентификатору
   */
  public getStream(streamId: string): MediaStream | undefined {
    return this.streams.get(streamId)?.stream;
  }

  /**
   * Получает все стримы
   */
  public getAllStreams(): MediaStream[] {
    return [...this.streams.values()].map((info) => {
      return info.stream;
    });
  }

  /**
   * Получает все идентификаторы стримов
   */
  public getStreamIds(): string[] {
    return [...this.streams.keys()];
  }

  /**
   * Очищает все стримы
   */
  public clear(): void {
    const streamIds = [...this.streams.keys()];

    streamIds.forEach((streamId) => {
      this.removeStream(streamId);
    });
  }

  /**
   * Проверяет, существует ли стрим с указанным идентификатором
   */
  public hasStream(streamId: string): boolean {
    return this.streams.has(streamId);
  }
}

export default RemoteMediaStreamManager;
