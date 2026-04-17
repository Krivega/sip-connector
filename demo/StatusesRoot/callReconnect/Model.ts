import { types } from 'mobx-state-tree';

import { ECallReconnectStatus as EState } from '@/index';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type {
  TCallReconnectContextMap,
  TCallReconnectSnapshot as TSnapshot,
  TSessionSnapshot,
} from '@/index';

/**
 * Snapshot модели — узкая выборка из снапшота XState-машины `CallReconnect`.
 * Храним `state` + `context` (в сыром виде через `types.frozen`), чтобы удобно
 * отрисовывать в UI и подписываться на изменения через MobX.
 */
type TSnapshotByState<TS extends EState> = TS extends EState
  ? Extract<TSnapshot, { value: TS }> extends { context: infer TContext }
    ? { state: TS; context: TContext }
    : never
  : never;

export type TCallReconnectStatusSnapshot = TSnapshotByState<EState>;

export const createCallReconnectStatusSnapshotFromSession = (
  snapshot: TSessionSnapshot,
): TSnapshotByState<EState> => {
  const state = snapshot.callReconnect.value;
  const { context } = snapshot.callReconnect;

  return {
    state,
    context,
  } as TCallReconnectStatusSnapshot;
};

export const CallReconnectStatusModel = types
  .model({
    state: types.enumeration('CallReconnectStatus', [
      EState.IDLE,
      EState.ARMED,
      EState.EVALUATING,
      EState.BACKOFF,
      EState.WAITING_SIGNALING,
      EState.ATTEMPTING,
      EState.LIMIT_REACHED,
      EState.ERROR_TERMINAL,
    ]),
    context: types.frozen<TCallReconnectContextMap[EState]>(),
  })
  .views((self) => {
    return {
      get snapshot(): TSnapshotByState<EState> {
        return {
          state: self.state,
          context: self.context,
        } as TCallReconnectStatusSnapshot;
      },
      /**
       * UI-флаг: показывать ли индикатор «переподключение».
       * Истинно, когда машина не в `idle` и не в `armed` (т.е. активно борется с обрывом).
       */
      get isReconnecting(): boolean {
        return (
          self.state !== EState.IDLE &&
          self.state !== EState.ARMED &&
          self.state !== EState.ERROR_TERMINAL
        );
      },
    };
  });

export type TCallReconnectStatusInstance = Instance<typeof CallReconnectStatusModel>;

export const INITIAL_CALL_RECONNECT_STATUS_SNAPSHOT = {
  state: EState.IDLE,
  context: {},
} as SnapshotIn<typeof CallReconnectStatusModel>;
