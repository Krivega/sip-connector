import { TypedEvents } from 'events-constructor';

export const NO_INBOUND_FRAMES_EVENT_NAME = 'no-inbound-frames' as const;

export const EVENT_NAMES = [NO_INBOUND_FRAMES_EVENT_NAME] as const;

export type TEventMap = {
  [NO_INBOUND_FRAMES_EVENT_NAME]: {
    isMutedMainVideoTrack: boolean;
    isInvalidInboundFrames: boolean;
    isInboundVideoFrozen: boolean;
  };
};

export type TEvents = TypedEvents<TEventMap>;

export const createEvents = () => {
  return new TypedEvents<TEventMap>(EVENT_NAMES);
};
