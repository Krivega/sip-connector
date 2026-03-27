import { EventEmitterProxy } from 'events-constructor';

import {
  createEvents,
  INBOUND_VIDEO_PROBLEM_DETECTED_EVENT_NAME,
  INBOUND_VIDEO_PROBLEM_RESET_EVENT_NAME,
  HEALTH_SNAPSHOT_EVENT_NAME,
  INBOUND_VIDEO_PROBLEM_RESOLVED_EVENT_NAME,
} from './events';

import type { CallManager } from '@/CallManager';
import type { StatsManager } from '@/StatsManager';
import type { TEventMap, THealthSnapshot, TProblemReason, TProblemResetCause } from './events';

const DEFAULT_MIN_CONSECUTIVE_PROBLEM_SAMPLES_COUNT = 3;

class MainStreamHealthMonitor extends EventEmitterProxy<TEventMap> {
  private readonly statsManager: StatsManager;

  private readonly callManager: CallManager;

  private minConsecutiveProblemSamplesCount: number;

  private consecutiveProblemSamplesCount = 0;

  private currentProblemReason: TProblemReason | undefined;

  private hasEmittedCurrentProblem = false;

  public constructor(
    statsManager: StatsManager,
    callManager: CallManager,
    minConsecutiveProblemSamplesCount: number = DEFAULT_MIN_CONSECUTIVE_PROBLEM_SAMPLES_COUNT,
  ) {
    super(createEvents());
    this.statsManager = statsManager;
    this.callManager = callManager;
    MainStreamHealthMonitor.assertValidMinConsecutiveProblemSamplesCount(
      minConsecutiveProblemSamplesCount,
    );
    this.minConsecutiveProblemSamplesCount = minConsecutiveProblemSamplesCount;

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

  private get isInvalidInboundFrames(): boolean {
    return this.statsManager.isInvalidInboundFrames;
  }

  private get isNoInboundVideoTraffic(): boolean {
    return this.statsManager.isNoInboundVideoTraffic;
  }

  private get isInboundVideoStalled(): boolean {
    return this.statsManager.isInboundVideoStalled;
  }

  private get healthSnapshot(): THealthSnapshot {
    return {
      isMutedMainVideoTrack: this.isMutedMainVideoTrack,
      isInvalidInboundFrames: this.isInvalidInboundFrames,
      isNoInboundVideoTraffic: this.isNoInboundVideoTraffic,
      isInboundVideoStalled: this.isInboundVideoStalled,
    };
  }

  private static resolveProblemReason(healthSnapshot: THealthSnapshot): TProblemReason | undefined {
    if (healthSnapshot.isInboundVideoStalled) {
      return 'inbound-video-stalled';
    }

    if (healthSnapshot.isNoInboundVideoTraffic) {
      return 'no-inbound-video-traffic';
    }

    if (healthSnapshot.isMutedMainVideoTrack && healthSnapshot.isInvalidInboundFrames) {
      return 'invalid-inbound-frames';
    }

    return undefined;
  }

  private static assertValidMinConsecutiveProblemSamplesCount(
    minConsecutiveProblemSamplesCount: number,
  ): void {
    if (
      !Number.isInteger(minConsecutiveProblemSamplesCount) ||
      minConsecutiveProblemSamplesCount < 1
    ) {
      throw new Error('minConsecutiveProblemSamplesCount should be a positive integer');
    }
  }

  public setMinConsecutiveProblemSamplesCount(minConsecutiveProblemSamplesCount: number): void {
    MainStreamHealthMonitor.assertValidMinConsecutiveProblemSamplesCount(
      minConsecutiveProblemSamplesCount,
    );
    this.minConsecutiveProblemSamplesCount = minConsecutiveProblemSamplesCount;
    this.resetProblemDetectionState();
  }

  private readonly handleStatsCollected = () => {
    const { healthSnapshot } = this;

    this.events.trigger(HEALTH_SNAPSHOT_EVENT_NAME, healthSnapshot);

    const problemReason = MainStreamHealthMonitor.resolveProblemReason(healthSnapshot);

    if (problemReason === undefined) {
      this.maybeEmitResolvedProblem(healthSnapshot);
      this.resetProblemDetectionState();

      return;
    }

    this.updateProblemDetectionState(problemReason);

    if (
      this.consecutiveProblemSamplesCount >= this.minConsecutiveProblemSamplesCount &&
      !this.hasEmittedCurrentProblem
    ) {
      this.events.trigger(INBOUND_VIDEO_PROBLEM_DETECTED_EVENT_NAME, {
        ...healthSnapshot,
        consecutiveProblemSamplesCount: this.consecutiveProblemSamplesCount,
        reason: problemReason,
      });
      this.hasEmittedCurrentProblem = true;
    }
  };

  private subscribe() {
    this.statsManager.on('collected', this.handleStatsCollected);
    this.callManager.on(
      'peerconnection:confirmed',
      this.handleProblemReset('peerconnection:confirmed'),
    );
    this.callManager.on('recv-session-started', this.handleProblemReset('recv-session-started'));
    this.callManager.on('recv-session-ended', this.handleProblemReset('recv-session-ended'));
    this.callManager.on('recv-quality-changed', this.handleProblemReset('recv-quality-changed'));
    this.callManager.on('failed', this.handleProblemReset('failed'));
    this.callManager.on('ended', this.handleProblemReset('ended'));
  }

  private readonly updateProblemDetectionState = (problemReason: TProblemReason) => {
    if (this.currentProblemReason === problemReason) {
      this.consecutiveProblemSamplesCount += 1;

      return;
    }

    this.currentProblemReason = problemReason;
    this.consecutiveProblemSamplesCount = 1;
    this.hasEmittedCurrentProblem = false;
  };

  private readonly maybeEmitResolvedProblem = (healthSnapshot: THealthSnapshot) => {
    if (!this.hasEmittedCurrentProblem || this.currentProblemReason === undefined) {
      return;
    }

    this.events.trigger(INBOUND_VIDEO_PROBLEM_RESOLVED_EVENT_NAME, {
      ...healthSnapshot,
      reason: this.currentProblemReason,
    });
  };

  private readonly handleProblemReset = (resetCause: TProblemResetCause) => {
    return () => {
      this.maybeEmitResetProblem(resetCause);
      this.resetProblemDetectionState();
    };
  };

  private readonly maybeEmitResetProblem = (resetCause: TProblemResetCause) => {
    if (!this.hasEmittedCurrentProblem || this.currentProblemReason === undefined) {
      return;
    }

    this.events.trigger(INBOUND_VIDEO_PROBLEM_RESET_EVENT_NAME, {
      reason: this.currentProblemReason,
      resetCause,
    });
  };

  private readonly resetProblemDetectionState = () => {
    this.currentProblemReason = undefined;
    this.consecutiveProblemSamplesCount = 0;
    this.hasEmittedCurrentProblem = false;
  };
}

export default MainStreamHealthMonitor;
