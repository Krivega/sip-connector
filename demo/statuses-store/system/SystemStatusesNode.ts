import { types } from 'mobx-state-tree';

import { ESystemStatus, sessionSelectors } from '@/index';
import { createNodeModel } from '../createNodeModel';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TSessionSnapshot } from '@/index';
import type { TStateOnlyNodeByState, TStateOnlyNodeValue } from '../nodeValue';

type TSystemNodeByState<TState extends ESystemStatus> = TStateOnlyNodeByState<TState>;

export type TSystemNodeValue = TStateOnlyNodeValue<ESystemStatus>;

const withStatusViews = <S extends ESystemStatus>(
  base: ReturnType<typeof createNodeModel<S, never>>,
) => {
  return base.views((self) => {
    return {
      get nodeValue(): TSystemNodeByState<S> {
        return { state: self.state };
      },
    };
  });
};

const SystemDisconnectedNodeModel = withStatusViews(
  createNodeModel<ESystemStatus.DISCONNECTED, never>(ESystemStatus.DISCONNECTED),
);
const SystemDisconnectingNodeModel = withStatusViews(
  createNodeModel<ESystemStatus.DISCONNECTING, never>(ESystemStatus.DISCONNECTING),
);
const SystemConnectingNodeModel = withStatusViews(
  createNodeModel<ESystemStatus.CONNECTING, never>(ESystemStatus.CONNECTING),
);
const SystemReadyToCallNodeModel = withStatusViews(
  createNodeModel<ESystemStatus.READY_TO_CALL, never>(ESystemStatus.READY_TO_CALL),
);
const SystemCallConnectingNodeModel = withStatusViews(
  createNodeModel<ESystemStatus.CALL_CONNECTING, never>(ESystemStatus.CALL_CONNECTING),
);
const SystemCallDisconnectingNodeModel = withStatusViews(
  createNodeModel<ESystemStatus.CALL_DISCONNECTING, never>(ESystemStatus.CALL_DISCONNECTING),
);
const SystemCallActiveNodeModel = withStatusViews(
  createNodeModel<ESystemStatus.CALL_ACTIVE, never>(ESystemStatus.CALL_ACTIVE),
);

export const SystemNodeModel = types.union(
  SystemDisconnectedNodeModel,
  SystemDisconnectingNodeModel,
  SystemConnectingNodeModel,
  SystemReadyToCallNodeModel,
  SystemCallConnectingNodeModel,
  SystemCallDisconnectingNodeModel,
  SystemCallActiveNodeModel,
);

export function mapSystemNodeFromSessionSnapshot(
  snapshot: TSessionSnapshot,
): SnapshotIn<typeof SystemNodeModel> {
  const state = sessionSelectors.selectSystemStatus(snapshot);

  return {
    state,
  } as SnapshotIn<typeof SystemNodeModel>;
}

export type TSystemNodeInstance = Instance<typeof SystemNodeModel>;

export const INITIAL_SYSTEM_NODE_SNAPSHOT = {
  state: ESystemStatus.DISCONNECTED,
} as SnapshotIn<typeof SystemNodeModel>;
