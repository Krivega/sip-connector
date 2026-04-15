import { types } from 'mobx-state-tree';

import { ESystemStatus, sessionSelectors } from '@/index';
import { createStatusStateModel } from '../createStatusStateModel';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TSessionSnapshot } from '@/index';
import type { TStateSnapshot, TStateSnapshotByState } from '../statusSnapshot';

type TSystemStatusSnapshotByState<TState extends ESystemStatus> = TStateSnapshotByState<TState>;

export type TSystemStatusSnapshot = TStateSnapshot<ESystemStatus>;

const withStatusSnapshotViews = <S extends ESystemStatus>(
  base: ReturnType<typeof createStatusStateModel<S, never>>,
) => {
  return base.views((self) => {
    return {
      get snapshot(): TSystemStatusSnapshotByState<S> {
        return { state: self.state };
      },
    };
  });
};

const SystemDisconnectedStatusModel = withStatusSnapshotViews(
  createStatusStateModel<ESystemStatus.DISCONNECTED, never>(ESystemStatus.DISCONNECTED),
);
const SystemDisconnectingStatusModel = withStatusSnapshotViews(
  createStatusStateModel<ESystemStatus.DISCONNECTING, never>(ESystemStatus.DISCONNECTING),
);
const SystemConnectingStatusModel = withStatusSnapshotViews(
  createStatusStateModel<ESystemStatus.CONNECTING, never>(ESystemStatus.CONNECTING),
);
const SystemReadyToCallStatusModel = withStatusSnapshotViews(
  createStatusStateModel<ESystemStatus.READY_TO_CALL, never>(ESystemStatus.READY_TO_CALL),
);
const SystemCallConnectingStatusModel = withStatusSnapshotViews(
  createStatusStateModel<ESystemStatus.CALL_CONNECTING, never>(ESystemStatus.CALL_CONNECTING),
);
const SystemCallDisconnectingStatusModel = withStatusSnapshotViews(
  createStatusStateModel<ESystemStatus.CALL_DISCONNECTING, never>(ESystemStatus.CALL_DISCONNECTING),
);
const SystemCallActiveStatusModel = withStatusSnapshotViews(
  createStatusStateModel<ESystemStatus.CALL_ACTIVE, never>(ESystemStatus.CALL_ACTIVE),
);

export const SystemStatusModel = types.union(
  SystemDisconnectedStatusModel,
  SystemDisconnectingStatusModel,
  SystemConnectingStatusModel,
  SystemReadyToCallStatusModel,
  SystemCallConnectingStatusModel,
  SystemCallDisconnectingStatusModel,
  SystemCallActiveStatusModel,
);

export function createSystemStatusSnapshotFromSession(
  snapshot: TSessionSnapshot,
): SnapshotIn<typeof SystemStatusModel> {
  const state = sessionSelectors.selectSystemStatus(snapshot);

  return {
    state,
  } as SnapshotIn<typeof SystemStatusModel>;
}

export type TSystemStatusInstance = Instance<typeof SystemStatusModel>;

export const INITIAL_SYSTEM_STATUS_SNAPSHOT = {
  state: ESystemStatus.DISCONNECTED,
} as SnapshotIn<typeof SystemStatusModel>;
