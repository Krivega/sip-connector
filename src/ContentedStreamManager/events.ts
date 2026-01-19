import { TypedEvents } from 'events-constructor';

import type { EContentedStreamCodec } from '@/ApiManager';

export enum EEvent {
  AVAILABLE = 'available',
  NOT_AVAILABLE = 'not-available',
}

export const EVENT_NAMES = [EEvent.AVAILABLE, EEvent.NOT_AVAILABLE] as const;

export type TEventMap = {
  available: { codec?: EContentedStreamCodec };
  'not-available': Record<string, never>;
};

export type TEvents = TypedEvents<TEventMap>;

export const createEvents = () => {
  return new TypedEvents<TEventMap>(EVENT_NAMES);
};
