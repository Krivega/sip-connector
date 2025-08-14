/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import type { TypedEvents } from 'events-constructor';
import type { TInbound, TOutbound } from './typings';

enum EEvent {
  COLLECTED = 'collected',
}

export type TEventMap = {
  collected: { outbound: TOutbound; inbound: TInbound };
};

export const EVENT_NAMES = [`${EEvent.COLLECTED}`] as const;

export type TEvents = TypedEvents<TEventMap>;
