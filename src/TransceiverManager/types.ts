/**
 * Интерфейс для хранения основных transceiver'ов
 */
export interface ITransceiverStorage {
  /** Основной transceiver для видео */
  mainVideo?: RTCRtpTransceiver;
  /** Основной transceiver для аудио */
  mainAudio?: RTCRtpTransceiver;
  /** Transceiver для презентации видео */
  presentationVideo?: RTCRtpTransceiver;
}
