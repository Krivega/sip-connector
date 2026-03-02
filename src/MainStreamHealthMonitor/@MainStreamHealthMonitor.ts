import { EventEmitterProxy } from '@/EventEmitterProxy';
import { createEvents, NO_INBOUND_FRAMES_EVENT_NAME } from './events';

import type { CallManager } from '@/CallManager';
import type { StatsManager } from '@/StatsManager';
import type { TEventMap } from './events';

class MainStreamHealthMonitor extends EventEmitterProxy<TEventMap> {
  private readonly statsManager: StatsManager;

  private readonly callManager: CallManager;

  public constructor(statsManager: StatsManager, callManager: CallManager) {
    super(createEvents());
    this.statsManager = statsManager;
    this.callManager = callManager;

    this.subscribe();
  }

  private get mainVideoTrack(): MediaStreamVideoTrack | undefined {
    const mainStream = this.callManager.getMainRemoteStream();

    return mainStream?.getVideoTracks()[0];
  }

  private get isMutedMainVideoTrack(): boolean {
    const { mainVideoTrack } = this;

    if (mainVideoTrack === undefined) {
      return false;
    }

    return mainVideoTrack.muted;
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
