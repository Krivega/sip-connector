import logger from '@/logger';
import { StatsPeerConnection } from '@/StatsPeerConnection';

import type { ApiManager } from '@/ApiManager';
import type { CallManager } from '@/CallManager';
import type { TStatsPeerConnectionEventMap, TStats } from '@/StatsPeerConnection';

class StatsManager {
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
    this.callManager = callManager;
    this.apiManager = apiManager;
    this.statsPeerConnection = new StatsPeerConnection();

    this.subscribe();
  }

  public get events() {
    return this.statsPeerConnection.events;
  }

  public get availableIncomingBitrate(): number | undefined {
    return this.availableStats?.inbound.additional.candidatePair?.availableIncomingBitrate;
  }

  public get isNotValidFramesStats(): boolean {
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

  public on<T extends keyof TStatsPeerConnectionEventMap>(
    eventName: T,
    handler: (data: TStatsPeerConnectionEventMap[T]) => void,
  ) {
    return this.statsPeerConnection.on(eventName, handler);
  }

  public once<T extends keyof TStatsPeerConnectionEventMap>(
    eventName: T,
    handler: (data: TStatsPeerConnectionEventMap[T]) => void,
  ) {
    return this.statsPeerConnection.once(eventName, handler);
  }

  public onceRace<T extends keyof TStatsPeerConnectionEventMap>(
    eventNames: T[],
    handler: (data: TStatsPeerConnectionEventMap[T], eventName: string) => void,
  ) {
    return this.statsPeerConnection.onceRace(eventNames, handler);
  }

  public async wait<T extends keyof TStatsPeerConnectionEventMap>(
    eventName: T,
  ): Promise<TStatsPeerConnectionEventMap[T]> {
    return this.statsPeerConnection.wait(eventName);
  }

  public off<T extends keyof TStatsPeerConnectionEventMap>(
    eventName: T,
    handler: (data: TStatsPeerConnectionEventMap[T]) => void,
  ) {
    this.statsPeerConnection.off(eventName, handler);
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
    this.callManager.on('failed', this.handleEnded);
    this.callManager.on('ended', this.handleEnded);
    this.statsPeerConnection.on('collected', this.handleStatsCollected);
  }

  private readonly handleStatsCollected = (data: TStats) => {
    this.previousAvailableStats = this.availableStats;
    this.availableStats = data;

    this.maybeSendStats();
  };

  private readonly handleStarted = (peerConnection: RTCPeerConnection) => {
    this.statsPeerConnection.start(peerConnection);
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
