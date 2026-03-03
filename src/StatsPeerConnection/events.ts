/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import { TypedEvents } from 'events-constructor';

import type { TInboundStats, TOutboundStats } from './types';

enum EEvent {
  COLLECTED = 'collected',
  STOPPED = 'stopped',
}

export type TEventMap = {
  collected: { outbound: TOutboundStats; inbound: TInboundStats };
  stopped: {
    reason: 'recv-session-started' | 'recv-session-ended' | 'recv-quality-changed' | 'call-ended';
  };
};

export const EVENT_NAMES = [`${EEvent.COLLECTED}`, `${EEvent.STOPPED}`] as const;

export type TEvents = TypedEvents<TEventMap>;

export const createEvents = () => {
  return new TypedEvents<TEventMap>(EVENT_NAMES);
};
