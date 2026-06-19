export const MIN_RECEIVED_MAIN_STREAM_PACKETS = 500;

/** Таймаут ожидания по умолчанию для `waitForOutboundVideoPackets` (мс). */
export const WAIT_OUTBOUND_VIDEO_PACKETS_TIMEOUT = 5000;

/**
 * Режим строгости верификации исходящего video после `replaceMediaStream`.
 *
 * - `fast` — минимальная проверка: track совпал и хотя бы +1 пакет от baseline.
 *   Подходит, когда важна скорость, а не гарантия прогрева encoder.
 * - `normal` — баланс: track + packets + bytes + frames от baseline (по умолчанию).
 * - `strict` — как `normal`, но требует 2 подряд poll'а с ростом метрик между соседними
 *   сэмплами (interval delta), чтобы отсечь «мигание» stats без устойчивой отправки.
 */
export type TOutboundVideoVerificationStrictness = 'fast' | 'normal' | 'strict';

/**
 * Пороги верификации для каждого режима strictness.
 *
 * Все дельты считаются от baseline, зафиксированного в момент вызова
 * `waitForOutboundVideoPackets`, а не от «предыдущего poll'а» внутри ожидания.
 *
 * `minPacketsSentDelta` — минимальный прирост `outbound-rtp.packetsSent` от baseline.
 * `minBytesSentDelta` — минимальный прирост `outbound-rtp.bytesSent` от baseline.
 * `minFramesDelta` — минимальный прирост кадров (max из `framesEncoded` и `mediaSource.frames`).
 * `requiredConsecutivePositiveSamples` — сколько подряд poll'ов должны пройти все проверки
 *   (в `strict` дополнительно нужен interval delta между соседними poll'ами).
 */
export const OUTBOUND_VIDEO_VERIFICATION_THRESHOLDS = {
  /** ~1 poll: track совпал + хотя бы 1 новый пакет от baseline. */
  fast: {
    minPacketsSentDelta: 1,
    minBytesSentDelta: 0,
    minFramesDelta: 0,
    requiredConsecutivePositiveSamples: 1,
  },
  /** ~1–2 poll: track + packets + ~8 KB + ≥3 кадра от baseline. */
  normal: {
    minPacketsSentDelta: 5,
    minBytesSentDelta: 8000,
    minFramesDelta: 3,
    requiredConsecutivePositiveSamples: 1,
  },
  /** ~2–3 poll: выше пороги + 2 подряд poll'а с interval delta между соседними сэмплами. */
  strict: {
    minPacketsSentDelta: 10,
    minBytesSentDelta: 16_000,
    minFramesDelta: 5,
    requiredConsecutivePositiveSamples: 2,
  },
} as const satisfies Record<
  TOutboundVideoVerificationStrictness,
  {
    minPacketsSentDelta: number;
    minBytesSentDelta: number;
    minFramesDelta: number;
    requiredConsecutivePositiveSamples: number;
  }
>;
