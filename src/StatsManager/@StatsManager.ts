import { EventEmitterProxy } from '@/EventEmitterProxy';
import logger from '@/logger';
import { StatsPeerConnection } from '@/StatsPeerConnection';
import { MIN_RECEIVED_MAIN_STREAM_PACKETS } from './constants';

import type { ApiManager } from '@/ApiManager';
import type { CallManager } from '@/CallManager';
import type { TStats, TStatsPeerConnectionEventMap } from '@/StatsPeerConnection';

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

  private get isReceivingPackets(): boolean {
    const isReceivingPackets =
      this.packetsReceived !== undefined &&
      this.packetsReceived >= MIN_RECEIVED_MAIN_STREAM_PACKETS;
    const isNotSameValue = this.packetsReceived !== this.previousPacketsReceived;

    return isReceivingPackets && isNotSameValue;
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

  private subscribe() {
    this.callManager.on('peerconnection:confirmed', this.handleStarted);
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

  private readonly handleStarted = () => {
    this.statsPeerConnection.start(this.callManager.getActivePeerConnection);
  };

  private readonly handleRecvSessionStarted = () => {
    this.statsPeerConnection.start(this.callManager.getActivePeerConnection);
  };

  private readonly handleRecvSessionEnded = () => {
    this.statsPeerConnection.start(this.callManager.getActivePeerConnection);
  };

  private readonly handleRecvQualityChanged = () => {
    this.statsPeerConnection.start(this.callManager.getActivePeerConnection);
  };

  private readonly handleEnded = () => {
    this.statsPeerConnection.stop();
    this.availableStats = undefined;
    this.previousAvailableStats = undefined;
  };

  private maybeSendStats() {
    if (
      this.availableIncomingBitrate !== undefined &&
      this.hasAvailableIncomingBitrateChangedQuarter()
    ) {
      this.apiManager
        .sendStats({ availableIncomingBitrate: this.availableIncomingBitrate })
        .catch((error: unknown) => {
          logger('Failed to send stats', error);
        });
    }
  }
}

export default StatsManager;
