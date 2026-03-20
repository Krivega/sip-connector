import { TypedEvents } from 'events-constructor';

export const HEALTH_SNAPSHOT_EVENT_NAME = 'health-snapshot' as const;
export const INBOUND_VIDEO_PROBLEM_DETECTED_EVENT_NAME = 'inbound-video-problem-detected' as const;

export const EVENT_NAMES = [
  HEALTH_SNAPSHOT_EVENT_NAME,
  INBOUND_VIDEO_PROBLEM_DETECTED_EVENT_NAME,
] as const;

export type TProblemReason =
  | 'invalid-inbound-frames'
  | 'no-inbound-video-traffic'
  | 'inbound-video-stalled';

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
};

export type TEvents = TypedEvents<TEventMap>;

export const createEvents = () => {
  return new TypedEvents<TEventMap>(EVENT_NAMES);
};
