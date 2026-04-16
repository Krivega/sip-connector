import { types } from 'mobx-state-tree';

import { ESystemStatus, sessionSelectors } from '@/index';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TSessionSnapshot } from '@/index';

export type TSystemStatusSnapshot = { state: ESystemStatus };

export const SystemStatusModel = types
  .model({
    state: types.enumeration('SystemStatus', [
      ESystemStatus.DISCONNECTED,
      ESystemStatus.DISCONNECTING,
      ESystemStatus.CONNECTING,
      ESystemStatus.READY_TO_CALL,
      ESystemStatus.CALL_CONNECTING,
      ESystemStatus.CALL_DISCONNECTING,
      ESystemStatus.CALL_ACTIVE,
    ]),
  })
  .views((self) => {
    return {
      get snapshot(): TSystemStatusSnapshot {
        return { state: self.state } as TSystemStatusSnapshot;
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
  state: ESystemStatus.DISCONNECTED,
} as SnapshotIn<typeof SystemStatusModel>;
