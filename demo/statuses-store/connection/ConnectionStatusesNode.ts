import { types } from 'mobx-state-tree';

import { EConnectionStatus, sessionSelectors } from '@/index';
import { createNodeModel } from '../createNodeModel';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TContextMap } from '@/ConnectionManager/ConnectionStateMachine';
import type { TSessionSnapshot } from '@/index';
import type { TNodeByState, TNodeValue } from '../nodeValue';

type TConnectionNodeByState<TState extends EConnectionStatus> = TNodeByState<TState, TContextMap>;

export type TConnectionNodeValue = TNodeValue<EConnectionStatus, TContextMap>;

const withNodeValueViews = <TState extends EConnectionStatus>(
  base: ReturnType<typeof createNodeModel<TState, TContextMap[TState]>>,
) => {
  return base
    .views((self) => {
      return {
        get nodeValue(): TConnectionNodeByState<TState> {
          return { state: self.state, context: self.context };
        },
      };
    })
    .views((self) => {
      return {
        hasIdle: (): boolean => {
          return self.nodeValue.state === EConnectionStatus.IDLE;
        },
        hasPreparing: (): boolean => {
          return self.nodeValue.state === EConnectionStatus.PREPARING;
        },
        hasConnecting: (): boolean => {
          return self.nodeValue.state === EConnectionStatus.CONNECTING;
        },
        hasConnected: (): boolean => {
          return self.nodeValue.state === EConnectionStatus.CONNECTED;
        },
        hasRegistered: (): boolean => {
          return self.nodeValue.state === EConnectionStatus.REGISTERED;
        },
        hasEstablished: (): boolean => {
          return self.nodeValue.state === EConnectionStatus.ESTABLISHED;
        },
        hasDisconnecting: (): boolean => {
          return self.nodeValue.state === EConnectionStatus.DISCONNECTING;
        },
        hasDisconnected: (): boolean => {
          return self.nodeValue.state === EConnectionStatus.DISCONNECTED;
        },
      };
    })
    .views((self) => {
      return {
        get connectionConfiguration(): TContextMap[TState]['connectionConfiguration'] {
          return self.context.connectionConfiguration;
        },
      };
    });
};

export function buildConnectionNodeFromSession(snapshot: TSessionSnapshot): TConnectionNodeValue {
  const state = sessionSelectors.selectConnectionStatus(snapshot);
  const {
    connection: { context },
  } = snapshot;

  return {
    state,
    context,
  } as TConnectionNodeValue;
}

const ConnectionIdleNodeModel = withNodeValueViews(
  createNodeModel<EConnectionStatus.IDLE, TContextMap[EConnectionStatus.IDLE]>(
    EConnectionStatus.IDLE,
  ),
);
const ConnectionPreparingNodeModel = withNodeValueViews(
  createNodeModel<EConnectionStatus.PREPARING, TContextMap[EConnectionStatus.PREPARING]>(
    EConnectionStatus.PREPARING,
  ),
);
const ConnectionConnectingNodeModel = withNodeValueViews(
  createNodeModel<EConnectionStatus.CONNECTING, TContextMap[EConnectionStatus.CONNECTING]>(
    EConnectionStatus.CONNECTING,
  ),
);
const ConnectionConnectedNodeModel = withNodeValueViews(
  createNodeModel<EConnectionStatus.CONNECTED, TContextMap[EConnectionStatus.CONNECTED]>(
    EConnectionStatus.CONNECTED,
  ),
);
const ConnectionRegisteredNodeModel = withNodeValueViews(
  createNodeModel<EConnectionStatus.REGISTERED, TContextMap[EConnectionStatus.REGISTERED]>(
    EConnectionStatus.REGISTERED,
  ),
);
const ConnectionEstablishedNodeModel = withNodeValueViews(
  createNodeModel<EConnectionStatus.ESTABLISHED, TContextMap[EConnectionStatus.ESTABLISHED]>(
    EConnectionStatus.ESTABLISHED,
  ),
);
const ConnectionDisconnectingNodeModel = withNodeValueViews(
  createNodeModel<EConnectionStatus.DISCONNECTING, TContextMap[EConnectionStatus.DISCONNECTING]>(
    EConnectionStatus.DISCONNECTING,
  ),
);
const ConnectionDisconnectedNodeModel = withNodeValueViews(
  createNodeModel<EConnectionStatus.DISCONNECTED, TContextMap[EConnectionStatus.DISCONNECTED]>(
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
