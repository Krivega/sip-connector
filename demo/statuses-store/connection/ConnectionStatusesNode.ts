import { types } from 'mobx-state-tree';

import { EConnectionStatus, sessionSelectors } from '@/index';
import { createNodeModel } from '../createNodeModel';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TSessionSnapshot } from '@/index';

type TConnectionContext = { registerRequired: boolean };

type TConnectionStatusesWithRegisterContext =
  | EConnectionStatus.PREPARING
  | EConnectionStatus.CONNECTING
  | EConnectionStatus.CONNECTED
  | EConnectionStatus.REGISTERED;

export type TConnectionNodeValue =
  | { state: EConnectionStatus.IDLE; context: Record<string, never> }
  | { state: EConnectionStatus.ESTABLISHED; context: Record<string, never> }
  | { state: EConnectionStatus.DISCONNECTING; context: Record<string, never> }
  | { state: EConnectionStatus.DISCONNECTED; context: Record<string, never> }
  | { state: TConnectionStatusesWithRegisterContext; context: TConnectionContext };

const withNodeValueViews = <S extends string, C>(
  base: ReturnType<typeof createNodeModel<S, C>>,
) => {
  return base.views((self) => {
    return {
      get nodeValue(): TConnectionNodeValue {
        return { state: self.state, context: self.context } as TConnectionNodeValue;
      },
    };
  });
};

const isConnectionStatusWithRegisterContext = (
  status: EConnectionStatus,
): status is TConnectionStatusesWithRegisterContext => {
  return (
    status === EConnectionStatus.PREPARING ||
    status === EConnectionStatus.CONNECTING ||
    status === EConnectionStatus.CONNECTED ||
    status === EConnectionStatus.REGISTERED
  );
};

export function buildConnectionNodeFromSession(snapshot: TSessionSnapshot): TConnectionNodeValue {
  const state = sessionSelectors.selectConnectionStatus(snapshot);

  if (isConnectionStatusWithRegisterContext(state)) {
    return {
      state,
      context: {
        registerRequired: snapshot.connection.context.registerRequired,
      },
    };
  }

  return {
    state,
    context: {},
  };
}

const ConnectionIdleNodeModel = withNodeValueViews(
  createNodeModel<EConnectionStatus.IDLE, Record<string, never>>(EConnectionStatus.IDLE),
);
const ConnectionPreparingNodeModel = withNodeValueViews(
  createNodeModel<EConnectionStatus.PREPARING, TConnectionContext>(EConnectionStatus.PREPARING),
);
const ConnectionConnectingNodeModel = withNodeValueViews(
  createNodeModel<EConnectionStatus.CONNECTING, TConnectionContext>(EConnectionStatus.CONNECTING),
);
const ConnectionConnectedNodeModel = withNodeValueViews(
  createNodeModel<EConnectionStatus.CONNECTED, TConnectionContext>(EConnectionStatus.CONNECTED),
);
const ConnectionRegisteredNodeModel = withNodeValueViews(
  createNodeModel<EConnectionStatus.REGISTERED, TConnectionContext>(EConnectionStatus.REGISTERED),
);
const ConnectionEstablishedNodeModel = withNodeValueViews(
  createNodeModel<EConnectionStatus.ESTABLISHED, Record<string, never>>(
    EConnectionStatus.ESTABLISHED,
  ),
);
const ConnectionDisconnectingNodeModel = withNodeValueViews(
  createNodeModel<EConnectionStatus.DISCONNECTING, Record<string, never>>(
    EConnectionStatus.DISCONNECTING,
  ),
);
const ConnectionDisconnectedNodeModel = withNodeValueViews(
  createNodeModel<EConnectionStatus.DISCONNECTED, Record<string, never>>(
    EConnectionStatus.DISCONNECTED,
  ),
);

export const ConnectionNodeModel = types.union(
  ConnectionIdleNodeModel,
  ConnectionPreparingNodeModel,
  ConnectionConnectingNodeModel,
  ConnectionConnectedNodeModel,
  ConnectionRegisteredNodeModel,
  ConnectionEstablishedNodeModel,
  ConnectionDisconnectingNodeModel,
  ConnectionDisconnectedNodeModel,
);

export type TConnectionNodeInstance = Instance<typeof ConnectionNodeModel>;

export const INITIAL_CONNECTION_NODE_SNAPSHOT = {
  state: EConnectionStatus.IDLE,
  context: {},
} as SnapshotIn<typeof ConnectionNodeModel>;
