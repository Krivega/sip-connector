/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import { TypedEvents } from 'events-constructor';

import type { TSessionSnapshot } from './types';

export enum EEvent {
  SNAPSHOT_CHANGED = 'snapshot-changed',
}

export const EVENT_NAMES = [`${EEvent.SNAPSHOT_CHANGED}`] as const;

export type TEventMap = {
  'snapshot-changed': {
    previous: TSessionSnapshot;
    current: TSessionSnapshot;
  };
};

export type TEvents = TypedEvents<TEventMap>;

export const createEvents = () => {
  return new TypedEvents<TEventMap>(EVENT_NAMES);
};
