import { types } from 'mobx-state-tree';

import { ESystemStatus, sessionSelectors } from '@/index';
import { createNodeModel } from '../createNodeModel';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TSessionSnapshot } from '@/index';

type TSystemNodeByState<TState extends ESystemStatus> = {
  state: TState;
};

export type TSystemNodeValue = {
  [TState in ESystemStatus]: TSystemNodeByState<TState>;
}[ESystemStatus];

const withNodeValueViews = <S extends ESystemStatus>(
  base: ReturnType<typeof createNodeModel<S, never>>,
) => {
  return base.views((self) => {
    return {
      get nodeValue(): TSystemNodeValue {
        return { state: self.state };
      },
    };
  });
};

export function buildSystemNodeFromSession(snapshot: TSessionSnapshot): TSystemNodeValue {
  const state = sessionSelectors.selectSystemStatus(snapshot);

  return {
    state,
  };
}

const SystemDisconnectedNodeModel = withNodeValueViews(
  createNodeModel<ESystemStatus.DISCONNECTED, never>(ESystemStatus.DISCONNECTED),
);
const SystemDisconnectingNodeModel = withNodeValueViews(
  createNodeModel<ESystemStatus.DISCONNECTING, never>(ESystemStatus.DISCONNECTING),
);
const SystemConnectingNodeModel = withNodeValueViews(
  createNodeModel<ESystemStatus.CONNECTING, never>(ESystemStatus.CONNECTING),
);
const SystemReadyToCallNodeModel = withNodeValueViews(
  createNodeModel<ESystemStatus.READY_TO_CALL, never>(ESystemStatus.READY_TO_CALL),
);
const SystemCallConnectingNodeModel = withNodeValueViews(
  createNodeModel<ESystemStatus.CALL_CONNECTING, never>(ESystemStatus.CALL_CONNECTING),
);
const SystemCallDisconnectingNodeModel = withNodeValueViews(
  createNodeModel<ESystemStatus.CALL_DISCONNECTING, never>(ESystemStatus.CALL_DISCONNECTING),
);
const SystemCallActiveNodeModel = withNodeValueViews(
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

export type TSystemNodeInstance = Instance<typeof SystemNodeModel>;

export const INITIAL_SYSTEM_NODE_SNAPSHOT = {
  state: ESystemStatus.DISCONNECTED,
} as SnapshotIn<typeof SystemNodeModel>;
