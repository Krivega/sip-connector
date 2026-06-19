import { EventEmitterProxy } from 'events-constructor';

import resolveDebug from '@/logger';
import { StatsPeerConnection } from '@/StatsPeerConnection';
import {
  MIN_RECEIVED_MAIN_STREAM_PACKETS,
  OUTBOUND_VIDEO_VERIFICATION_THRESHOLDS,
  WAIT_OUTBOUND_VIDEO_PACKETS_TIMEOUT,
} from './constants';

import type { ApiManager } from '@/ApiManager';
import type { CallManager } from '@/CallManager';
import type { TStats, TStatsPeerConnectionEventMap } from '@/StatsPeerConnection';
import type { TOutboundVideoVerificationStrictness } from './constants';
import type { TOutboundVideoStatsSnapshot } from './types';

const debug = resolveDebug('StatsManager');

class StatsManager extends EventEmitterProxy<TStatsPeerConnectionEventMap> {
  public readonly statsPeerConnection: StatsPeerConnection;

  private availableStats: TStats | undefined;

  private previousAvailableStats: TStats | undefined;

  private readonly callManager: CallManager;

  private readonly apiManager: ApiManager;

  public constructor({
    callManager,
    apiManager,
  }: {
    callManager: CallManager;
    apiManager: ApiManager;
  }) {
    const statsPeerConnection = new StatsPeerConnection();

    super(statsPeerConnection.events);
    this.statsPeerConnection = statsPeerConnection;
    this.callManager = callManager;
    this.apiManager = apiManager;

    this.subscribe();
  }

  public get availableIncomingBitrate(): number | undefined {
    return this.availableStats?.inbound.additional.candidatePair?.availableIncomingBitrate;
  }

  public get isInvalidInboundFrames(): boolean {
    return this.isEmptyInboundFrames && this.isReceivingPackets;
  }

  public get isNoInboundVideoTraffic(): boolean {
    return this.packetsReceived === 0 && this.bytesReceived === 0;
  }

  public get isInboundVideoStalled(): boolean {
    if (
      this.packetsReceived === undefined ||
      this.previousPacketsReceived === undefined ||
      this.bytesReceived === undefined ||
      this.previousBytesReceived === undefined
    ) {
      return false;
    }

    const hasInboundTrafficBefore =
      this.previousPacketsReceived > 0 || this.previousBytesReceived > 0;
    const havePacketsStopped = this.packetsReceived === this.previousPacketsReceived;
    const haveBytesStopped = this.bytesReceived === this.previousBytesReceived;

    return hasInboundTrafficBefore && havePacketsStopped && haveBytesStopped;
  }

  private get isEmptyInboundFrames(): boolean {
    return !this.isFramesReceived || !this.isFramesDecoded;
  }

  private get previousAvailableIncomingBitrate(): number | undefined {
    return this.previousAvailableStats?.inbound.additional.candidatePair?.availableIncomingBitrate;
  }

  private get previousInboundRtp(): RTCInboundRtpStreamStats | undefined {
    return this.previousAvailableStats?.inbound.video.inboundRtp;
  }

  private get previousFramesReceived(): number | undefined {
    return this.previousInboundRtp?.framesReceived;
  }

  private get previousFramesDecoded(): number | undefined {
    return this.previousInboundRtp?.framesDecoded;
  }

  private get inboundRtp(): RTCInboundRtpStreamStats | undefined {
    return this.availableStats?.inbound.video.inboundRtp;
  }

  private get framesReceived(): number | undefined {
    return this.inboundRtp?.framesReceived;
  }

  private get framesDecoded(): number | undefined {
    return this.inboundRtp?.framesDecoded;
  }

  private get isFramesReceived(): boolean {
    const isFramesReceived = this.framesReceived !== undefined && this.framesReceived > 0;
    const isNotSameValue = this.framesReceived !== this.previousFramesReceived;

    return isFramesReceived && isNotSameValue;
  }

  private get isFramesDecoded(): boolean {
    const isFramesDecoded = this.framesDecoded !== undefined && this.framesDecoded > 0;
    const isNotSameValue = this.framesDecoded !== this.previousFramesDecoded;

    return isFramesDecoded && isNotSameValue;
  }

  private get packetsReceived(): number | undefined {
    return this.inboundRtp?.packetsReceived;
  }

  private get previousPacketsReceived(): number | undefined {
    return this.previousInboundRtp?.packetsReceived;
  }

  private get bytesReceived(): number | undefined {
    return this.inboundRtp?.bytesReceived;
  }

  private get previousBytesReceived(): number | undefined {
    return this.previousInboundRtp?.bytesReceived;
  }

  private get isReceivingPackets(): boolean {
    const isReceivingMoreThanMinPackets =
      this.packetsReceived !== undefined &&
      this.packetsReceived >= MIN_RECEIVED_MAIN_STREAM_PACKETS;
    const isNotSameValue = this.packetsReceived !== this.previousPacketsReceived;

    return isReceivingMoreThanMinPackets && isNotSameValue;
  }

  private get outboundVideoBytesSent(): number | undefined {
    return this.availableStats?.outbound.video.outboundRtp?.bytesSent;
  }

  private get outboundVideoFramesEncoded(): number | undefined {
    return this.availableStats?.outbound.video.outboundRtp?.framesEncoded;
  }

  private get outboundVideoMediaSourceFrames(): number | undefined {
    return this.availableStats?.outbound.video.mediaSource?.frames;
  }

  private get previousOutboundVideoBytesSent(): number | undefined {
    return this.previousAvailableStats?.outbound.video.outboundRtp?.bytesSent;
  }

  private get previousOutboundVideoFramesEncoded(): number | undefined {
    return this.previousAvailableStats?.outbound.video.outboundRtp?.framesEncoded;
  }

  private get previousOutboundVideoMediaSourceFrames(): number | undefined {
    return this.previousAvailableStats?.outbound.video.mediaSource?.frames;
  }

  /**
   * Вычисляет дельту метрики относительно baseline.
   *
   * Если `current` отсутствует в stats — дельту определить нельзя (undefined).
   * Если baseline отсутствует (пустой snapshot, stats ещё не собирались) — считаем baseline = 0,
   * т.е. любое положительное current уже считается приростом после замены.
   */
  private static resolveDelta(current?: number, baseline?: number): number | undefined {
    if (current === undefined) {
      return undefined;
    }

    return current - (baseline ?? 0);
  }

  /**
   * Дельта кадров: берём максимум из двух источников WebRTC stats.
   *
   * Браузеры могут заполнять либо `outbound-rtp.framesEncoded`, либо `media-source.frames`,
   * либо оба. Для верификации достаточно роста хотя бы в одном из них.
   *
   * Если в current нет ни одного frame-счётчика — дельту кадров определить нельзя.
   */
  private static resolveFramesDelta(
    current: TOutboundVideoStatsSnapshot,
    baseline: TOutboundVideoStatsSnapshot,
  ): number | undefined {
    if (current.framesEncoded === undefined && current.mediaSourceFrames === undefined) {
      return undefined;
    }

    const framesEncodedDelta = StatsManager.resolveDelta(
      current.framesEncoded,
      baseline.framesEncoded,
    );
    const mediaSourceFramesDelta = StatsManager.resolveDelta(
      current.mediaSourceFrames,
      baseline.mediaSourceFrames,
    );

    return Math.max(framesEncodedDelta ?? 0, mediaSourceFramesDelta ?? 0);
  }

  /** Извлекает outbound video-поля из полного объекта stats (`collected`). */
  private static extractOutboundVideoStatsSnapshot(
    stats: TStats | undefined,
  ): TOutboundVideoStatsSnapshot {
    if (stats === undefined) {
      return {};
    }

    return {
      trackIdentifier: stats.outbound.video.mediaSource?.trackIdentifier,
      packetsSent: stats.outbound.video.outboundRtp?.packetsSent,
      bytesSent: stats.outbound.video.outboundRtp?.bytesSent,
      framesEncoded: stats.outbound.video.outboundRtp?.framesEncoded,
      mediaSourceFrames: stats.outbound.video.mediaSource?.frames,
    };
  }

  /**
   * Ожидает, пока stats подтвердят реальную отправку video с указанным track id.
   *
   * ## Алгоритм
   *
   * 1. Фиксируем baseline — snapshot метрик до начала ожидания (см. `captureOutboundVideoWaitBaseline`).
   * 2. На каждом событии `collected` (poll stats ~раз в 1 с) проверяем current против baseline.
   * 3. Успех, когда `isSendingOutboundVideoPacketsWithTrack` возвращает `isSending: true`.
   * 4. При таймауте — reject с ошибкой.
   *
   * ## Почему baseline, а не previous poll
   *
   * Сравнение с «предыдущим poll'ом» даёт ложное срабатывание сразу после replace:
   * `trackIdentifier` уже новый, а `packetsSent` вырос на +1 между двумя соседними сэмплами.
   * Baseline фиксирует состояние **на момент вызова wait** (сразу после replaceMediaStream),
   * поэтому мы ждём накопленный прирост трафика **после замены**, а не любой монotonic tick.
   *
   * @param trackId — `MediaStreamTrack.id` нового video track из replaceMediaStream
   * @param timeout — максимальное время ожидания (мс)
   * @param strictness — режим порогов (см. `OUTBOUND_VIDEO_VERIFICATION_THRESHOLDS`)
   */
  public async waitForOutboundVideoPackets(
    trackId: string,
    {
      timeout = WAIT_OUTBOUND_VIDEO_PACKETS_TIMEOUT,
      strictness = 'normal',
    }: {
      timeout?: number;
      strictness?: TOutboundVideoVerificationStrictness;
    } = {},
  ): Promise<void> {
    // Baseline: «точка отсчёта» для всех дельт на протяжении ожидания.
    const baseline = this.captureOutboundVideoWaitBaseline();
    // Счётчик подряд идущих poll'ов, прошедших все проверки (важно для strict).
    const verificationState = { consecutivePositiveSamples: 0 };

    // Быстрый путь: условие уже выполнено на текущем snapshot (без ожидания следующего poll'а).
    if (
      this.isSendingOutboundVideoPacketsWithTrack(
        trackId,
        { baseline, strictness },
        verificationState,
      ).isSending
    ) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout>;
      let disposeCollectedListener: () => void;

      const cleanup = () => {
        clearTimeout(timeoutId);
        disposeCollectedListener();
      };

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for outbound-rtp packets with video track ${trackId}`));
      }, timeout);

      disposeCollectedListener = this.on('collected', () => {
        const { isSending, newVerificationState } = this.isSendingOutboundVideoPacketsWithTrack(
          trackId,
          { baseline, strictness },
          verificationState,
        );

        if (isSending) {
          cleanup();
          resolve();
        } else {
          // Сохраняем прогресс consecutive-счётчика между poll'ами (или сброс внутри проверки).
          verificationState.consecutivePositiveSamples = newVerificationState;
        }
      });
    });
  }

  public hasAvailableIncomingBitrateChangedQuarter() {
    const prev = this.previousAvailableIncomingBitrate;
    const current = this.availableIncomingBitrate;

    if (prev === undefined || current === undefined) {
      return false;
    }

    if (prev === 0) {
      return current > 0;
    }

    const delta = Math.abs(current - prev) / prev;

    return delta >= 0.25;
  }

  private getOutboundVideoStatsSnapshot(): TOutboundVideoStatsSnapshot {
    return StatsManager.extractOutboundVideoStatsSnapshot(this.availableStats);
  }

  /**
   * Фиксирует baseline для wait сразу после replaceMediaStream.
   *
   * Берём `previousAvailableStats`, если он есть: это последний poll **до** текущего
   * `availableStats`, т.е. состояние «до замены» или непосредственно перед ней.
   * Если stats ещё ни разу не собирались — fallback на `availableStats` или пустой объект.
   */
  private captureOutboundVideoWaitBaseline(): TOutboundVideoStatsSnapshot {
    const stats = this.previousAvailableStats ?? this.availableStats;

    if (stats === undefined) {
      return {};
    }

    return StatsManager.extractOutboundVideoStatsSnapshot(stats);
  }

  /**
   * Проверяет, что current stats удовлетворяют порогам strictness относительно baseline.
   *
   * Шаги:
   * 1. `media-source.trackIdentifier` должен совпасть с id нового track (metadata swap).
   * 2. Дельта `packetsSent` от baseline >= порога.
   * 3. Дельта `bytesSent` от baseline >= порога (в fast может быть 0).
   * 4. Для `normal`/`strict`: дельта кадров >= порога (fast кадры не проверяет).
   */
  private meetsOutboundVideoThresholds(
    trackId: string,
    baseline: TOutboundVideoStatsSnapshot,
    strictness: TOutboundVideoVerificationStrictness,
  ): boolean {
    const current = this.getOutboundVideoStatsSnapshot();
    const thresholds = OUTBOUND_VIDEO_VERIFICATION_THRESHOLDS[strictness];

    // Шаг 1: в stats уже должен быть именно новый track, а не старый media-source.
    if (current.trackIdentifier !== trackId) {
      return false;
    }

    const packetsSentDelta = StatsManager.resolveDelta(current.packetsSent, baseline.packetsSent);
    const bytesSentDelta = StatsManager.resolveDelta(current.bytesSent, baseline.bytesSent);
    const framesDelta = StatsManager.resolveFramesDelta(current, baseline);

    // Шаг 2: без packetsSent в current stats верификацию продолжать нельзя.
    if (packetsSentDelta === undefined || packetsSentDelta < thresholds.minPacketsSentDelta) {
      return false;
    }

    // Шаг 3: bytesSent подтверждает объём, а не только счётчик пакетов.
    if ((bytesSentDelta ?? 0) < thresholds.minBytesSentDelta) {
      return false;
    }

    // Шаг 4: frames — сигнал, что encoder реально кодирует новый source (не только RTP tick).
    if (
      strictness !== 'fast' &&
      (framesDelta === undefined || framesDelta < thresholds.minFramesDelta)
    ) {
      return false;
    }

    return true;
  }

  /**
   * Interval delta: рост метрик между двумя **соседними** poll'ами stats.
   *
   * Используется только в режиме `strict`. Отличается от baseline-delta:
   * baseline отвечает на «сколько отправили с момента replace», interval — «идёт ли отправка
   * прямо сейчас между poll N и poll N+1».
   *
   * Если на одном poll'е пороги от baseline уже выполнены, но на следующем poll'е счётчики
   * не выросли — strict сбрасывает consecutive-счётчик (отправка не устойчива).
   */
  private hasPositiveOutboundVideoIntervalDelta(): boolean {
    const bytesSent = this.outboundVideoBytesSent;
    const previousBytesSent = this.previousOutboundVideoBytesSent;
    const framesEncoded = this.outboundVideoFramesEncoded;
    const previousFramesEncoded = this.previousOutboundVideoFramesEncoded;
    const mediaSourceFrames = this.outboundVideoMediaSourceFrames;
    const previousMediaSourceFrames = this.previousOutboundVideoMediaSourceFrames;

    if (
      bytesSent !== undefined &&
      previousBytesSent !== undefined &&
      bytesSent > previousBytesSent
    ) {
      return true;
    }

    if (
      framesEncoded !== undefined &&
      previousFramesEncoded !== undefined &&
      framesEncoded > previousFramesEncoded
    ) {
      return true;
    }

    if (
      mediaSourceFrames !== undefined &&
      previousMediaSourceFrames !== undefined &&
      mediaSourceFrames > previousMediaSourceFrames
    ) {
      return true;
    }

    return false;
  }

  /**
   * Главная проверка: «отправляется ли video с нужным track» на текущем poll'е.
   *
   * Возвращает:
   * - `isSending: true` — все условия выполнены, можно резолвить wait-промис.
   * - `newVerificationState` — обновлённый счётчик consecutive poll'ов (для strict — 2 подряд).
   *
   * Логика:
   * 1. `meetsOutboundVideoThresholds` — baseline-проверка (track + deltas).
   * 2. Для `strict`: дополнительно `hasPositiveOutboundVideoIntervalDelta`.
   * 3. Если оба шага OK — increment consecutive; иначе сброс в 0.
   * 4. Успех, когда consecutive >= `requiredConsecutivePositiveSamples`.
   */
  private isSendingOutboundVideoPacketsWithTrack(
    trackId: string,
    options: {
      baseline: TOutboundVideoStatsSnapshot;
      strictness: TOutboundVideoVerificationStrictness;
    },
    verificationState: { consecutivePositiveSamples: number },
  ) {
    const { baseline, strictness } = options;

    const thresholds = OUTBOUND_VIDEO_VERIFICATION_THRESHOLDS[strictness];

    if (!this.meetsOutboundVideoThresholds(trackId, baseline, strictness)) {
      // Пороги не выполнены — прогресс consecutive обнуляется.
      return { isSending: false, newVerificationState: 0 };
    }

    if (strictness === 'strict' && !this.hasPositiveOutboundVideoIntervalDelta()) {
      // Baseline OK, но между этим и предыдущим poll'ом нет роста — не считаем устойчивой отправкой.
      return { isSending: false, newVerificationState: 0 };
    }

    const newVerificationState = verificationState.consecutivePositiveSamples + 1;

    return {
      isSending: newVerificationState >= thresholds.requiredConsecutivePositiveSamples,
      newVerificationState,
    };
  }

  private subscribe() {
    this.callManager.on('peerconnection:confirmed', this.start);
    this.callManager.on('recv-session-started', this.handleRecvSessionStarted);
    this.callManager.on('recv-session-ended', this.handleRecvSessionEnded);
    this.callManager.on('recv-quality-changed', this.handleRecvQualityChanged);
    this.callManager.on('failed', this.handleEnded);
    this.callManager.on('ended', this.handleEnded);
    this.statsPeerConnection.on('collected', this.handleStatsCollected);
  }

  private readonly handleStatsCollected = (data: TStats) => {
    this.previousAvailableStats = this.availableStats;
    this.availableStats = data;

    this.maybeSendStats();
  };

  private readonly start = () => {
    this.statsPeerConnection.start(this.callManager.getActivePeerConnection);
  };

  private readonly stop = (
    reason: 'recv-session-started' | 'recv-session-ended' | 'recv-quality-changed' | 'call-ended',
  ) => {
    this.statsPeerConnection.stop({ reason });
    this.availableStats = undefined;
    this.previousAvailableStats = undefined;
  };

  private restart(reason: 'recv-session-started' | 'recv-session-ended' | 'recv-quality-changed') {
    this.stop(reason);
    this.statsPeerConnection.start(this.callManager.getActivePeerConnection);
  }

  private readonly handleRecvSessionStarted = () => {
    this.restart('recv-session-started');
  };

  private readonly handleRecvSessionEnded = () => {
    this.restart('recv-session-ended');
  };

  private readonly handleRecvQualityChanged = () => {
    this.restart('recv-quality-changed');
  };

  private readonly handleEnded = () => {
    this.stop('call-ended');
  };

  private maybeSendStats() {
    if (
      this.availableIncomingBitrate !== undefined &&
      this.hasAvailableIncomingBitrateChangedQuarter()
    ) {
      this.apiManager
        .sendStats({ availableIncomingBitrate: this.availableIncomingBitrate })
        .catch((error: unknown) => {
          debug('Failed to send stats', error);
        });
    }
  }
}

export default StatsManager;
