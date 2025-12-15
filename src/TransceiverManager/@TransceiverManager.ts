import type { ApiManager } from '@/ApiManager';
import type { CallManager } from '@/CallManager';
import type { ITransceiverStorage } from './types';

/**
 * Менеджер для управления RTCRtpTransceiver'ами
 * Отвечает за хранение и классификацию transceiver'ов по типам:
 * - mainAudio: основной transceiver для аудио (mid='0')
 * - mainVideo: основной transceiver для видео (mid='1')
 * - presentationVideo: transceiver для презентации видео (mid='2')
 */
export class TransceiverManager {
  /**
   * Хранилище основных transceiver'ов
   */
  private readonly transceivers: ITransceiverStorage = {};

  private readonly callManager: CallManager;

  public constructor({ callManager }: { callManager: CallManager; apiManager: ApiManager }) {
    this.callManager = callManager;

    this.subscribe();
  }

  /**
   * Сохраняет transceiver в соответствующем хранилище в зависимости от типа трека и mid
   */
  public storeTransceiver(transceiver: RTCRtpTransceiver, track: MediaStreamTrack): void {
    const { kind } = track;

    if (kind === 'audio') {
      // Для аудио всегда сохраняем как основной transceiver
      this.transceivers.mainAudio ??= transceiver;
    } else {
      // Для видео определяем тип по mid transceiver'а
      const { mid } = transceiver;
      const isPresentationVideo = mid === '2';

      if (isPresentationVideo) {
        this.transceivers.presentationVideo ??= transceiver;
      } else {
        this.transceivers.mainVideo ??= transceiver;
      }
    }
  }

  /**
   * Возвращает все сохраненные transceiver'ы
   */
  public getTransceivers(): Readonly<ITransceiverStorage> {
    return { ...this.transceivers };
  }

  /**
   * Возвращает основной аудио transceiver
   */
  public getMainAudioTransceiver(): RTCRtpTransceiver | undefined {
    return this.transceivers.mainAudio;
  }

  /**
   * Возвращает основной видео transceiver
   */
  public getMainVideoTransceiver(): RTCRtpTransceiver | undefined {
    return this.transceivers.mainVideo;
  }

  /**
   * Возвращает презентационный видео transceiver
   */
  public getPresentationVideoTransceiver(): RTCRtpTransceiver | undefined {
    return this.transceivers.presentationVideo;
  }

  /**
   * Проверяет, есть ли сохраненный transceiver для указанного типа
   */
  public hasTransceiver(type: keyof ITransceiverStorage): boolean {
    return this.transceivers[type] !== undefined;
  }

  /**
   * Очищает все сохраненные transceiver'ы
   */
  public clear(): void {
    this.transceivers.mainVideo = undefined;
    this.transceivers.mainAudio = undefined;
    this.transceivers.presentationVideo = undefined;
  }

  /**
   * Возвращает количество сохраненных transceiver'ов
   */
  public getCount(): number {
    let count = 0;

    if (this.transceivers.mainAudio) {
      count += 1;
    }

    if (this.transceivers.mainVideo) {
      count += 1;
    }

    if (this.transceivers.presentationVideo) {
      count += 1;
    }

    return count;
  }

  /**
   * Проверяет, пустое ли хранилище
   */
  public isEmpty(): boolean {
    return this.getCount() === 0;
  }

  private subscribe() {
    this.callManager.on('peerconnection:ontrack', this.handleTrack);

    this.callManager.on('failed', this.handleEnded);
    this.callManager.on('ended', this.handleEnded);
  }

  private readonly handleTrack = (event: RTCTrackEvent) => {
    this.storeTransceiver(event.transceiver, event.track);
  };

  private readonly handleEnded = () => {
    this.clear();
  };
}

export default TransceiverManager;
