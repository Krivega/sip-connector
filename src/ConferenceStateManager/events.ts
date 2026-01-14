/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import { TypedEvents } from 'events-constructor';

import type { TConferenceState } from './types';

export enum EEvent {
  STATE_CHANGED = 'state-changed',
  STATE_RESET = 'state-reset',
}

export const EVENT_NAMES = [`${EEvent.STATE_CHANGED}`, `${EEvent.STATE_RESET}`] as const;

export type TEventMap = {
  'state-changed': {
    previous: TConferenceState;
    current: TConferenceState;
    updates: Partial<TConferenceState>;
  };
  'state-reset': Record<string, never>;
};

export type TEvents = TypedEvents<TEventMap>;

export const createEvents = () => {
  return new TypedEvents<TEventMap>(EVENT_NAMES);
};
