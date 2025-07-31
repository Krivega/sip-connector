/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import type { Events } from 'events-constructor';

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
export type TEvents = Events<typeof EVENT_NAMES>;
