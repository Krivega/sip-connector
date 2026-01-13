/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import { TypedEvents } from 'events-constructor';

export enum EEvent {
  START_PRESENTATION = 'presentation:start',
  STARTED_PRESENTATION = 'presentation:started',
  END_PRESENTATION = 'presentation:end',
  ENDED_PRESENTATION = 'presentation:ended',
  FAILED_PRESENTATION = 'presentation:failed',
}

export const EVENT_NAMES = [
  `${EEvent.START_PRESENTATION}`,
  `${EEvent.STARTED_PRESENTATION}`,
  `${EEvent.END_PRESENTATION}`,
  `${EEvent.ENDED_PRESENTATION}`,
  `${EEvent.FAILED_PRESENTATION}`,
] as const;

export type TEvent = (typeof EVENT_NAMES)[number];

export type TEventMap = {
  'presentation:start': MediaStream;
  'presentation:started': MediaStream;
  'presentation:end': MediaStream;
  'presentation:ended': MediaStream;
  'presentation:failed': Error;
};

export type TEvents = TypedEvents<TEventMap>;

export const createEvents = () => {
  return new TypedEvents<TEventMap>(EVENT_NAMES);
};
