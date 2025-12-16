import getMediaStream from './utils/getMediaStream';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import VideoPlayer from './VideoPlayer';

/**
 * Класс для управления MediaStream
 * Инициализирует и управляет медиа-потоком с помощью getUserMedia
 */
class LocalMediaStreamManager {
  private mediaStream: MediaStream | undefined = undefined;

  private videoPlayer: VideoPlayer | undefined = undefined;

  /**
   * Инициализирует MediaStream
   * @returns Promise с MediaStream
   */
  public async initialize(): Promise<MediaStream> {
    if (this.mediaStream) {
      return this.mediaStream;
    }

    this.mediaStream = await getMediaStream();

    if (this.videoPlayer) {
      this.videoPlayer.setStream(this.mediaStream);
    }

    return this.mediaStream;
  }

  /**
   * Возвращает текущий MediaStream
   */
  public getStream(): MediaStream | undefined {
    return this.mediaStream;
  }

  /**
   * Подключает VideoPlayer для отображения потока
   */
  public setVideoPlayer(videoPlayer: VideoPlayer): void {
    this.videoPlayer = videoPlayer;

    if (this.mediaStream) {
      videoPlayer.setStream(this.mediaStream);
    }
  }

  /**
   * Останавливает все треки в MediaStream
   */
  public stop(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        track.stop();
      });

      this.mediaStream = undefined;

      if (this.videoPlayer) {
        this.videoPlayer.clear();
      }
    }
  }

  /**
   * Останавливает конкретный трек по типу
   */
  public stopTrack(kind: 'audio' | 'video'): void {
    if (this.mediaStream) {
      const tracks =
        kind === 'audio' ? this.mediaStream.getAudioTracks() : this.mediaStream.getVideoTracks();

      tracks.forEach((track) => {
        track.stop();
      });
    }
  }

  /**
   * Проверяет, инициализирован ли MediaStream
   */
  public isInitialized(): boolean {
    return this.mediaStream !== undefined;
  }

  /**
   * Получает активные треки по типу
   */
  public getTracks(kind?: 'audio' | 'video'): MediaStreamTrack[] {
    if (!this.mediaStream) {
      return [];
    }

    if (kind === 'audio') {
      return this.mediaStream.getAudioTracks();
    }

    if (kind === 'video') {
      return this.mediaStream.getVideoTracks();
    }

    return this.mediaStream.getTracks();
  }
}

export default LocalMediaStreamManager;
