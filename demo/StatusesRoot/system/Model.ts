import { types } from 'mobx-state-tree';

import { ESystemStatus as EState, sessionSelectors } from '@/index';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TSessionSnapshot } from '@/index';

export type TSystemStatusSnapshot = { state: EState };

export const SystemStatusModel = types
  .model({
    state: types.enumeration('SystemStatus', [
      EState.DISCONNECTED,
      EState.DISCONNECTING,
      EState.CONNECTING,
      EState.READY_TO_CALL,
      EState.CALL_CONNECTING,
      EState.CALL_DISCONNECTING,
      EState.CALL_ACTIVE,
    ]),
  })
  .views((self) => {
    return {
      get snapshot(): TSystemStatusSnapshot {
        return { state: self.state } as TSystemStatusSnapshot;
      },
    };
  })
  .views((self) => {
    const hasState = (state: EState): boolean => {
      return self.state === state;
    };

    return {
      isDisconnected(): boolean {
        return hasState(EState.DISCONNECTED);
      },
      isDisconnecting(): boolean {
        return hasState(EState.DISCONNECTING);
      },
      isConnecting(): boolean {
        return hasState(EState.CONNECTING);
      },
      isReadyToCall(): boolean {
        return hasState(EState.READY_TO_CALL);
      },
      isCallConnecting(): boolean {
        return hasState(EState.CALL_CONNECTING);
      },
      isCallDisconnecting(): boolean {
        return hasState(EState.CALL_DISCONNECTING);
      },
      isCallActive(): boolean {
        return hasState(EState.CALL_ACTIVE);
      },
    };
  });

export const createSystemStatusSnapshotFromSession = (
  snapshot: TSessionSnapshot,
): SnapshotIn<typeof SystemStatusModel> => {
  const state = sessionSelectors.selectSystemStatus(snapshot);

  return {
    state,
  } as SnapshotIn<typeof SystemStatusModel>;
};

export type TSystemStatusInstance = Instance<typeof SystemStatusModel>;

export const INITIAL_SYSTEM_STATUS_SNAPSHOT = {
  state: EState.DISCONNECTED,
} as SnapshotIn<typeof SystemStatusModel>;

export { ESystemStatus } from '@/index';
