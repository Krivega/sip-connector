import type { TRemoteCallerData } from '../events';
import type { EEvents, EState } from './constants';

export type TFinishedReason = EState.CONSUMED | EState.DECLINED | EState.TERMINATED | EState.FAILED;

export type TIncomingMachineEvents =
  | { type: EEvents.RINGING; data: TRemoteCallerData }
  | { type: EEvents.CONSUMED }
  | { type: EEvents.DECLINED; data: TRemoteCallerData }
  | { type: EEvents.TERMINATED; data: TRemoteCallerData }
  | { type: EEvents.FAILED; data: TRemoteCallerData }
  | { type: EEvents.CLEAR };

export type TContextMap = {
  [EState.IDLE]: {
    remoteCallerData: undefined;
    lastReason: undefined;
  };
  [EState.RINGING]: {
    remoteCallerData: TRemoteCallerData;
    lastReason: undefined;
  };
  [EState.CONSUMED]: {
    remoteCallerData: TRemoteCallerData;
    lastReason: EState.CONSUMED;
  };
  [EState.DECLINED]: {
    remoteCallerData: TRemoteCallerData;
    lastReason: EState.DECLINED;
  };
  [EState.TERMINATED]: {
    remoteCallerData: TRemoteCallerData;
    lastReason: EState.TERMINATED;
  };
  [EState.FAILED]: {
    remoteCallerData: TRemoteCallerData;
    lastReason: EState.FAILED;
  };
};

export type TContext = TContextMap[keyof TContextMap];
