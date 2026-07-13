/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import { TypedEvents } from 'events-constructor';

enum EEvent {
  START_PRESENTATION = 'start',
  STARTED_PRESENTATION = 'started',
  UPDATING_PRESENTATION = 'updating',
  UPDATED_PRESENTATION = 'updated',
  END_PRESENTATION = 'end',
  ENDED_PRESENTATION = 'ended',
  FAILED_PRESENTATION = 'failed',
}

export const EVENT_NAMES = [
  `${EEvent.START_PRESENTATION}`,
  `${EEvent.STARTED_PRESENTATION}`,
  `${EEvent.UPDATING_PRESENTATION}`,
  `${EEvent.UPDATED_PRESENTATION}`,
  `${EEvent.END_PRESENTATION}`,
  `${EEvent.ENDED_PRESENTATION}`,
  `${EEvent.FAILED_PRESENTATION}`,
] as const;

export type TEventMap = {
  start: MediaStreamVideoTrack;
  started: MediaStreamVideoTrack;
  updating: MediaStreamVideoTrack;
  updated: MediaStreamVideoTrack;
  end: MediaStreamVideoTrack;
  ended: MediaStreamVideoTrack;
  failed: Error;
};

export type TEvents = TypedEvents<TEventMap>;

export const createEvents = () => {
  return new TypedEvents<TEventMap>(EVENT_NAMES);
};
