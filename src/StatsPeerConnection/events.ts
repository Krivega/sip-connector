/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import { TypedEvents } from 'events-constructor';

import type { TInboundStats, TOutboundStats } from './types';

enum EEvent {
  COLLECTED = 'collected',
}

export type TEventMap = {
  collected: { outbound: TOutboundStats; inbound: TInboundStats };
};

export const EVENT_NAMES = [`${EEvent.COLLECTED}`] as const;

export type TEvents = TypedEvents<TEventMap>;

export const createEvents = () => {
  return new TypedEvents<TEventMap>(EVENT_NAMES);
};
