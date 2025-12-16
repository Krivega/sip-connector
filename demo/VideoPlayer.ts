/**
 * Класс для управления видео-плеером
 * Подключает MediaStream к video элементу
 */
class VideoPlayer {
  private readonly videoElement: HTMLVideoElement;

  /**
   * Создает экземпляр VideoPlayer
   * @param videoId - ID video элемента в DOM
   */
  public constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement;
  }

  /**
   * Подключает MediaStream к видео-плееру
   */
  public setStream(stream: MediaStream | undefined): void {
    // eslint-disable-next-line unicorn/no-null
    this.videoElement.srcObject = stream ?? null;
  }

  /**
   * Получает текущий MediaStream из видео-плеера
   */
  public getStream(): MediaStream | undefined {
    return this.videoElement.srcObject as MediaStream | undefined;
  }

  /**
   * Включает или выключает воспроизведение
   */
  public setPlaying(playing: boolean): void {
    if (playing) {
      this.videoElement.play().catch(() => {
        // Игнорируем ошибки воспроизведения
      });
    } else {
      this.videoElement.pause();
    }
  }

  /**
   * Включает или выключает звук
   */
  public setMuted(muted: boolean): void {
    this.videoElement.muted = muted;
  }

  /**
   * Проверяет, включен ли звук
   */
  public isMuted(): boolean {
    return this.videoElement.muted;
  }

  /**
   * Получает video элемент
   */
  public getVideoElement(): HTMLVideoElement {
    return this.videoElement;
  }

  /**
   * Очищает поток из видео-плеера
   */
  public clear(): void {
    // eslint-disable-next-line unicorn/no-null
    this.videoElement.srcObject = null;
  }
}

export default VideoPlayer;
