import logger from '@/logger';
import { StatsPeerConnection } from '@/StatsPeerConnection';

import type { ApiManager } from '@/ApiManager';
import type { CallManager } from '@/CallManager';
import type { TEventMap } from '@/StatsPeerConnection';

type TStats = TEventMap['collected'];

class StatsManager {
  public availableIncomingBitrate: number | undefined;

  public readonly statsPeerConnection: StatsPeerConnection;

  private readonly callManager: CallManager;

  private readonly apiManager: ApiManager;

  private previousAvailableIncomingBitrate: number | undefined;

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

  public on<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.statsPeerConnection.on(eventName, handler);
  }

  public once<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.statsPeerConnection.once(eventName, handler);
  }

  public onceRace<T extends keyof TEventMap>(
    eventNames: T[],
    handler: (data: TEventMap[T], eventName: string) => void,
  ) {
    return this.statsPeerConnection.onceRace(eventNames, handler);
  }

  public async wait<T extends keyof TEventMap>(eventName: T): Promise<TEventMap[T]> {
    return this.statsPeerConnection.wait(eventName);
  }

  public off<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
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
    this.previousAvailableIncomingBitrate = this.availableIncomingBitrate;
    this.availableIncomingBitrate = data.inbound.additional.candidatePair?.availableIncomingBitrate;

    this.maybeSendStats();
  };

  private readonly handleStarted = (peerConnection: RTCPeerConnection) => {
    this.statsPeerConnection.start(peerConnection);
  };

  private readonly handleEnded = () => {
    this.statsPeerConnection.stop();
    this.availableIncomingBitrate = undefined;
    this.previousAvailableIncomingBitrate = undefined;
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
