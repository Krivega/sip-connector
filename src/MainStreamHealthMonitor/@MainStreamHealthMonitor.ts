import { TypedEvents } from 'events-constructor';

import { EVENT_NAMES, NO_INBOUND_FRAMES_EVENT_NAME } from './eventNames';

import type { CallManager } from '@/CallManager';
import type { StatsManager } from '@/StatsManager';
import type { TEventMap } from './eventNames';
import type { TMainStreamHealthMonitor, TStats } from './types';

class MainStreamHealthMonitor implements TMainStreamHealthMonitor {
  public readonly events: TypedEvents<TEventMap>;

  private readonly statsManager: StatsManager;

  private readonly callManager: CallManager;

  private previousStats: TStats | undefined;

  public constructor(statsManager: StatsManager, callManager: CallManager) {
    this.statsManager = statsManager;
    this.callManager = callManager;
    this.events = new TypedEvents<TEventMap>(EVENT_NAMES);

    this.subscribe();
  }

  private get mainVideoTrack(): MediaStreamVideoTrack | undefined {
    const mainStream = this.callManager.getMainStream();

    return mainStream?.getVideoTracks()[0];
  }

  private get isMutedMainVideoTrack(): boolean {
    const { mainVideoTrack } = this;

    if (mainVideoTrack === undefined) {
      return false;
    }

    return mainVideoTrack.readyState === 'live' && mainVideoTrack.muted;
  }

  private get previousInboundRtp(): RTCInboundRtpStreamStats | undefined {
    return this.previousStats?.inbound.video.inboundRtp;
  }

  private get previousFramesReceived(): number | undefined {
    return this.previousInboundRtp?.framesReceived;
  }

  private get previousFramesDecoded(): number | undefined {
    return this.previousInboundRtp?.framesDecoded;
  }

  public readonly reset = () => {
    this.previousStats = undefined;
  };

  public on<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.events.on(eventName, handler);
  }

  private readonly handleStatsCollected = (stats: TStats) => {
    if (this.hasNoIncomingFrames(stats)) {
      this.events.trigger(NO_INBOUND_FRAMES_EVENT_NAME, {});
    }

    this.savePreviousStats(stats);
  };

  private readonly hasNoIncomingFrames = (stats: TStats): boolean => {
    const { inboundRtp } = stats.inbound.video;

    if (inboundRtp === undefined) {
      return false;
    }

    return this.hasNotValidFramesStats(inboundRtp) && this.isMutedMainVideoTrack;
  };

  private hasNotValidFramesStats(inboundRtp: RTCInboundRtpStreamStats): boolean {
    return !this.hasFramesReceived(inboundRtp) || !this.hasFramesDecoded(inboundRtp);
  }

  private hasFramesReceived({ framesReceived }: RTCInboundRtpStreamStats): boolean {
    const isFramesReceived = framesReceived !== undefined && framesReceived > 0;
    const isNotSameValue = framesReceived !== this.previousFramesReceived;

    return isFramesReceived && isNotSameValue;
  }

  private hasFramesDecoded({ framesDecoded }: RTCInboundRtpStreamStats): boolean {
    const isFramesDecoded = framesDecoded !== undefined && framesDecoded > 0;
    const isNotSameValue = framesDecoded !== this.previousFramesDecoded;

    return isFramesDecoded && isNotSameValue;
  }

  private savePreviousStats(stats: TStats) {
    this.previousStats = stats;
  }

  private subscribe() {
    this.statsManager.on('collected', this.handleStatsCollected);
  }
}

export default MainStreamHealthMonitor;
