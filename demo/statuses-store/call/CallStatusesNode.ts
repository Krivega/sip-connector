import { types } from 'mobx-state-tree';

import { ECallStatus } from '@/index';
import { createNodeModel } from '../createNodeModel';
import { getContextProperty } from './getContextProperty';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TContextMap } from '@/CallManager/CallStateMachine';
import type { TSessionSnapshot } from '@/index';
import type { TNodeByState, TNodeValue } from '../nodeValue';

type TCallNodeByState<TState extends ECallStatus> = TNodeByState<TState, TContextMap>;

export type TCallNodeValue = TNodeValue<ECallStatus, TContextMap>;

const withNodeValueViews = <TState extends ECallStatus>(
  base: ReturnType<typeof createNodeModel<TState, TContextMap[TState]>>,
) => {
  return base
    .views((self) => {
      return {
        get nodeValue(): TCallNodeByState<TState> {
          return { state: self.state, context: self.context };
        },
      };
    })
    .views((self) => {
      return {
        hasIdle: (): boolean => {
          return self.nodeValue.state === ECallStatus.IDLE;
        },
        hasConnecting: (): boolean => {
          return self.nodeValue.state === ECallStatus.CONNECTING;
        },
        hasPresentationCall: (): boolean => {
          return self.nodeValue.state === ECallStatus.PRESENTATION_CALL;
        },
        hasRoomPendingAuth: (): boolean => {
          return self.nodeValue.state === ECallStatus.ROOM_PENDING_AUTH;
        },
        hasPurgatory: (): boolean => {
          return self.nodeValue.state === ECallStatus.PURGATORY;
        },
        hasP2PRoom: (): boolean => {
          return self.nodeValue.state === ECallStatus.P2P_ROOM;
        },
        hasDirectP2PRoom: (): boolean => {
          return self.nodeValue.state === ECallStatus.DIRECT_P2P_ROOM;
        },
        hasInRoom: (): boolean => {
          return self.nodeValue.state === ECallStatus.IN_ROOM;
        },
        hasDisconnecting: (): boolean => {
          return self.nodeValue.state === ECallStatus.DISCONNECTING;
        },
      };
    })
    .views((self) => {
      return {
        get pendingDisconnect(): true | undefined {
          return getContextProperty(self.context, 'pendingDisconnect');
        },
        get number(): string | undefined {
          return getContextProperty(self.context, 'number');
        },
        get answer(): boolean | undefined {
          return getContextProperty(self.context, 'answer');
        },
        get extraHeaders(): string[] | undefined {
          return getContextProperty(self.context, 'extraHeaders');
        },
        get isConfirmed(): true | undefined {
          return getContextProperty(self.context, 'isConfirmed');
        },
        get room(): string | undefined {
          return getContextProperty(self.context, 'room');
        },
        get participantName(): string | undefined {
          return getContextProperty(self.context, 'participantName');
        },
        get isDirectPeerToPeer(): true | undefined {
          return getContextProperty(self.context, 'isDirectPeerToPeer');
        },
        get token(): string | undefined {
          return getContextProperty(self.context, 'token');
        },
        get conferenceForToken(): string | undefined {
          return getContextProperty(self.context, 'conferenceForToken');
        },
      };
    });
};

export function buildCallNodeFromSession(snapshot: TSessionSnapshot): TCallNodeValue {
  const {
    call: {
      value: state,
      context: { state: context },
    },
  } = snapshot;

  return {
    state,
    context,
  } as TCallNodeValue;
}

const CallIdleNodeModel = withNodeValueViews(
  createNodeModel<ECallStatus.IDLE, TContextMap[ECallStatus.IDLE]>(ECallStatus.IDLE),
);
const CallConnectingNodeModel = withNodeValueViews(
  createNodeModel<ECallStatus.CONNECTING, TContextMap[ECallStatus.CONNECTING]>(
    ECallStatus.CONNECTING,
  ),
);
const CallPresentationCallNodeModel = withNodeValueViews(
  createNodeModel<ECallStatus.PRESENTATION_CALL, TContextMap[ECallStatus.PRESENTATION_CALL]>(
    ECallStatus.PRESENTATION_CALL,
  ),
);
const CallRoomPendingAuthNodeModel = withNodeValueViews(
  createNodeModel<ECallStatus.ROOM_PENDING_AUTH, TContextMap[ECallStatus.ROOM_PENDING_AUTH]>(
    ECallStatus.ROOM_PENDING_AUTH,
  ),
);
const CallPurgatoryNodeModel = withNodeValueViews(
  createNodeModel<ECallStatus.PURGATORY, TContextMap[ECallStatus.PURGATORY]>(ECallStatus.PURGATORY),
);
const CallP2PRoomNodeModel = withNodeValueViews(
  createNodeModel<ECallStatus.P2P_ROOM, TContextMap[ECallStatus.P2P_ROOM]>(ECallStatus.P2P_ROOM),
);
const CallDirectP2PRoomNodeModel = withNodeValueViews(
  createNodeModel<ECallStatus.DIRECT_P2P_ROOM, TContextMap[ECallStatus.DIRECT_P2P_ROOM]>(
    ECallStatus.DIRECT_P2P_ROOM,
  ),
);
const CallInRoomNodeModel = withNodeValueViews(
  createNodeModel<ECallStatus.IN_ROOM, TContextMap[ECallStatus.IN_ROOM]>(ECallStatus.IN_ROOM),
);
const CallDisconnectingNodeModel = withNodeValueViews(
  createNodeModel<ECallStatus.DISCONNECTING, TContextMap[ECallStatus.DISCONNECTING]>(
    ECallStatus.DISCONNECTING,
  ),
);

export const CallNodeModel = types.union(
  CallIdleNodeModel,
  CallConnectingNodeModel,
  CallPresentationCallNodeModel,
  CallRoomPendingAuthNodeModel,
  CallPurgatoryNodeModel,
  CallP2PRoomNodeModel,
  CallDirectP2PRoomNodeModel,
  CallInRoomNodeModel,
  CallDisconnectingNodeModel,
);

export type TCallNodeInstance = Instance<typeof CallNodeModel>;

export const INITIAL_CALL_NODE_SNAPSHOT = {
  state: ECallStatus.IDLE,
  context: {},
} as SnapshotIn<typeof CallNodeModel>;
