import type { TEventMap as TStatsEventMap } from '@/StatsPeerConnection';
import type { TEventMap } from './eventNames';

export type TStats = TStatsEventMap['collected'];

type TDisposer = () => void;

export type TMainStreamHealthMonitor = {
  on: <T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) => TDisposer;
  reset: () => void;
};
