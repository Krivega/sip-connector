/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import type { TypedEvents } from 'events-constructor';
import type { TInboundStats, TOutboundStats } from './types';

enum EEvent {
  COLLECTED = 'collected',
}

export type TEventMap = {
  collected: { outbound: TOutboundStats; inbound: TInboundStats };
};

export const EVENT_NAMES = [`${EEvent.COLLECTED}`] as const;

export type TEvents = TypedEvents<TEventMap>;
