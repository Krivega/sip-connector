import { createEvents, NO_INBOUND_FRAMES_EVENT_NAME } from './events';

import type { CallManager } from '@/CallManager';
import type { StatsManager } from '@/StatsManager';
import type { TEventMap, TEvents } from './events';

class MainStreamHealthMonitor {
  public readonly events: TEvents;

  private readonly statsManager: StatsManager;

  private readonly callManager: CallManager;

  public constructor(statsManager: StatsManager, callManager: CallManager) {
    this.statsManager = statsManager;
    this.callManager = callManager;
    this.events = createEvents();

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

    return mainVideoTrack.muted;
  }

  public on<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.events.on(eventName, handler);
  }

  private readonly handleStatsCollected = () => {
    if (this.hasNoIncomingFrames()) {
      this.events.trigger(NO_INBOUND_FRAMES_EVENT_NAME, {});
    }
  };

  private readonly hasNoIncomingFrames = (): boolean => {
    return this.statsManager.isInvalidInboundFrames && this.isMutedMainVideoTrack;
  };

  private subscribe() {
    this.statsManager.on('collected', this.handleStatsCollected);
  }
}

export default MainStreamHealthMonitor;
