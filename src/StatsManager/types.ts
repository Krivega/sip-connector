/**
 * Снимок outbound video-метрик из WebRTC stats на один момент времени.
 * Используется как baseline (до/на момент замены) и как current (на каждом poll'е).
 */
export type TOutboundVideoStatsSnapshot = {
  /** `media-source.trackIdentifier` — UUID MediaStreamTrack, привязанный к sender. */
  trackIdentifier?: string;
  /** `outbound-rtp.packetsSent` — счётчик отправленных RTP-пакетов. */
  packetsSent?: number;
  /** `outbound-rtp.bytesSent` — объём полезных данных (без заголовков). */
  bytesSent?: number;
  /** `outbound-rtp.framesEncoded` — сколько кадров encoder закодировал. */
  framesEncoded?: number;
  /** `media-source.frames` — сколько кадров поступило в video source (альтернативный сигнал). */
  mediaSourceFrames?: number;
};
