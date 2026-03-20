import { TypedEvents } from 'events-constructor';

export const HEALTH_SNAPSHOT_EVENT_NAME = 'health-snapshot' as const;
export const INBOUND_VIDEO_PROBLEM_DETECTED_EVENT_NAME = 'inbound-video-problem-detected' as const;
export const INBOUND_VIDEO_PROBLEM_RESOLVED_EVENT_NAME = 'inbound-video-problem-resolved' as const;
export const INBOUND_VIDEO_PROBLEM_RESET_EVENT_NAME = 'inbound-video-problem-reset' as const;

export const EVENT_NAMES = [
  HEALTH_SNAPSHOT_EVENT_NAME,
  INBOUND_VIDEO_PROBLEM_DETECTED_EVENT_NAME,
  INBOUND_VIDEO_PROBLEM_RESOLVED_EVENT_NAME,
  INBOUND_VIDEO_PROBLEM_RESET_EVENT_NAME,
] as const;

export type TProblemReason =
  | 'invalid-inbound-frames'
  | 'no-inbound-video-traffic'
  | 'inbound-video-stalled';

export type TProblemResetCause =
  | 'peerconnection:confirmed'
  | 'recv-session-started'
  | 'recv-session-ended'
  | 'recv-quality-changed'
  | 'failed'
  | 'ended';

export type THealthSnapshot = {
  isMutedMainVideoTrack: boolean;
  isInvalidInboundFrames: boolean;
  isNoInboundVideoTraffic: boolean;
  isInboundVideoStalled: boolean;
};

export type TEventMap = {
  [HEALTH_SNAPSHOT_EVENT_NAME]: THealthSnapshot;
  [INBOUND_VIDEO_PROBLEM_DETECTED_EVENT_NAME]: THealthSnapshot & {
    consecutiveProblemSamplesCount: number;
    reason: TProblemReason;
  };
  [INBOUND_VIDEO_PROBLEM_RESOLVED_EVENT_NAME]: THealthSnapshot & {
    reason: TProblemReason;
  };
  [INBOUND_VIDEO_PROBLEM_RESET_EVENT_NAME]: {
    reason: TProblemReason;
    resetCause: TProblemResetCause;
  };
};

export type TEvents = TypedEvents<TEventMap>;

export const createEvents = () => {
  return new TypedEvents<TEventMap>(EVENT_NAMES);
};
