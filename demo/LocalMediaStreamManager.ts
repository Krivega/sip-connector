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

  /**
   * Включает камеру
   */
  public enableCamera(): void {
    if (!this.mediaStream) {
      throw new Error('MediaStream не инициализирован');
    }

    const { mediaStream } = { mediaStream: this.mediaStream };
    const videoTracks = mediaStream.getVideoTracks();

    // Если трек есть и он активен, просто размучиваем его
    if (videoTracks.length > 0 && videoTracks[0].readyState === 'live') {
      for (const track of videoTracks) {
        track.enabled = true;
      }
    }
  }

  /**
   * Выключает камеру
   */
  public disableCamera(): void {
    if (!this.mediaStream) {
      return;
    }

    const { mediaStream } = { mediaStream: this.mediaStream };
    const videoTracks = mediaStream.getVideoTracks();

    for (const track of videoTracks) {
      track.enabled = false;
    }
  }

  /**
   * Включает микрофон
   */
  public enableMic(): void {
    if (!this.mediaStream) {
      throw new Error('MediaStream не инициализирован');
    }

    const { mediaStream } = { mediaStream: this.mediaStream };
    const audioTracks = mediaStream.getAudioTracks();

    // Если трек есть и он активен, просто размучиваем его
    if (audioTracks.length > 0 && audioTracks[0].readyState === 'live') {
      for (const track of audioTracks) {
        track.enabled = true;
      }
    }
  }

  /**
   * Выключает микрофон
   */
  public disableMic(): void {
    if (!this.mediaStream) {
      return;
    }

    const { mediaStream } = { mediaStream: this.mediaStream };
    const audioTracks = mediaStream.getAudioTracks();

    for (const track of audioTracks) {
      track.enabled = false;
    }
  }

  /**
   * Проверяет, включена ли камера
   */
  public isCameraEnabled(): boolean {
    if (!this.mediaStream) {
      return false;
    }

    const videoTracks = this.mediaStream.getVideoTracks();

    return videoTracks.length > 0 && videoTracks[0].readyState === 'live' && videoTracks[0].enabled;
  }

  /**
   * Проверяет, включен ли микрофон
   */
  public isMicEnabled(): boolean {
    if (!this.mediaStream) {
      return false;
    }

    const audioTracks = this.mediaStream.getAudioTracks();

    return audioTracks.length > 0 && audioTracks[0].readyState === 'live' && audioTracks[0].enabled;
  }

  /**
   * Обрабатывает переключение камеры
   */
  public toggleCamera(): void {
    const isCameraEnabled = this.isCameraEnabled();

    if (isCameraEnabled) {
      this.disableCamera();
    } else {
      this.enableCamera();
    }
  }

  /**
   * Обрабатывает переключение микрофона
   */
  public toggleMic(): void {
    const isMicEnabled = this.isMicEnabled();

    if (isMicEnabled) {
      this.disableMic();
    } else {
      this.enableMic();
    }
  }
}

export default LocalMediaStreamManager;
