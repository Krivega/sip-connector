import { ECallReconnectStatus as EState } from '@/index';

import type { TCallReconnectStatusSnapshot, TSnapshotByState } from './Model';

export const isCallReconnectIdle = (
  snapshot: TCallReconnectStatusSnapshot,
): snapshot is TSnapshotByState<EState.IDLE> => {
  return snapshot.state === EState.IDLE;
};

export const isCallReconnectArmed = (
  snapshot: TCallReconnectStatusSnapshot,
): snapshot is TSnapshotByState<EState.ARMED> => {
  return snapshot.state === EState.ARMED;
};

export const isCallReconnectEvaluating = (
  snapshot: TCallReconnectStatusSnapshot,
): snapshot is TSnapshotByState<EState.EVALUATING> => {
  return snapshot.state === EState.EVALUATING;
};

export const isCallReconnectBackoff = (
  snapshot: TCallReconnectStatusSnapshot,
): snapshot is TSnapshotByState<EState.BACKOFF> => {
  return snapshot.state === EState.BACKOFF;
};

export const isCallReconnectWaitingSignaling = (
  snapshot: TCallReconnectStatusSnapshot,
): snapshot is TSnapshotByState<EState.WAITING_SIGNALING> => {
  return snapshot.state === EState.WAITING_SIGNALING;
};

export const isCallReconnectAttempting = (
  snapshot: TCallReconnectStatusSnapshot,
): snapshot is TSnapshotByState<EState.ATTEMPTING> => {
  return snapshot.state === EState.ATTEMPTING;
};

export const isCallReconnectLimitReached = (
  snapshot: TCallReconnectStatusSnapshot,
): snapshot is TSnapshotByState<EState.LIMIT_REACHED> => {
  return snapshot.state === EState.LIMIT_REACHED;
};

export const isCallReconnectErrorTerminal = (
  snapshot: TCallReconnectStatusSnapshot,
): snapshot is TSnapshotByState<EState.ERROR_TERMINAL> => {
  return snapshot.state === EState.ERROR_TERMINAL;
};
