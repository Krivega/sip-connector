import { types } from 'mobx-state-tree';

import { ECallStatus } from '@/index';
import { createNodeModel } from '../createNodeModel';
import { readContextField } from './utils';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TContextMap } from '@/CallManager/CallStateMachine';
import type { TSessionSnapshot } from '@/index';
import type { TStatusNodeByState, TStatusNodeValue } from '../nodeValue';

type TCallNodeByState<TState extends ECallStatus> = TStatusNodeByState<TState, TContextMap>;

export type TCallNodeValue = TStatusNodeValue<ECallStatus, TContextMap>;

const withStatusViews = <TState extends ECallStatus>(
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
          return readContextField(self.context, 'pendingDisconnect');
        },
        get number(): string | undefined {
          return readContextField(self.context, 'number');
        },
        get answer(): boolean | undefined {
          return readContextField(self.context, 'answer');
        },
        get extraHeaders(): string[] | undefined {
          return readContextField(self.context, 'extraHeaders');
        },
        get isConfirmed(): true | undefined {
          return readContextField(self.context, 'isConfirmed');
        },
        get room(): string | undefined {
          return readContextField(self.context, 'room');
        },
        get participantName(): string | undefined {
          return readContextField(self.context, 'participantName');
        },
        get isDirectPeerToPeer(): true | undefined {
          return readContextField(self.context, 'isDirectPeerToPeer');
        },
        get token(): string | undefined {
          return readContextField(self.context, 'token');
        },
        get conferenceForToken(): string | undefined {
          return readContextField(self.context, 'conferenceForToken');
        },
      };
    });
};

export function mapCallNodeFromSessionSnapshot(snapshot: TSessionSnapshot): TCallNodeValue {
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

const CallIdleNodeModel = withStatusViews(
  createNodeModel<ECallStatus.IDLE, TContextMap[ECallStatus.IDLE]>(ECallStatus.IDLE),
);
const CallConnectingNodeModel = withStatusViews(
  createNodeModel<ECallStatus.CONNECTING, TContextMap[ECallStatus.CONNECTING]>(
    ECallStatus.CONNECTING,
  ),
);
const CallPresentationCallNodeModel = withStatusViews(
  createNodeModel<ECallStatus.PRESENTATION_CALL, TContextMap[ECallStatus.PRESENTATION_CALL]>(
    ECallStatus.PRESENTATION_CALL,
  ),
);
const CallRoomPendingAuthNodeModel = withStatusViews(
  createNodeModel<ECallStatus.ROOM_PENDING_AUTH, TContextMap[ECallStatus.ROOM_PENDING_AUTH]>(
    ECallStatus.ROOM_PENDING_AUTH,
  ),
);
const CallPurgatoryNodeModel = withStatusViews(
  createNodeModel<ECallStatus.PURGATORY, TContextMap[ECallStatus.PURGATORY]>(ECallStatus.PURGATORY),
);
const CallP2PRoomNodeModel = withStatusViews(
  createNodeModel<ECallStatus.P2P_ROOM, TContextMap[ECallStatus.P2P_ROOM]>(ECallStatus.P2P_ROOM),
);
const CallDirectP2PRoomNodeModel = withStatusViews(
  createNodeModel<ECallStatus.DIRECT_P2P_ROOM, TContextMap[ECallStatus.DIRECT_P2P_ROOM]>(
    ECallStatus.DIRECT_P2P_ROOM,
  ),
);
const CallInRoomNodeModel = withStatusViews(
  createNodeModel<ECallStatus.IN_ROOM, TContextMap[ECallStatus.IN_ROOM]>(ECallStatus.IN_ROOM),
);
const CallDisconnectingNodeModel = withStatusViews(
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
