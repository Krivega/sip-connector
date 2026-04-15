import { types } from 'mobx-state-tree';

import { ECallStatus } from '@/index';
import { createStatusStateModel } from '../createStatusStateModel';
import { getCallContextField } from './utils';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TContextMap } from '@/CallManager/CallStateMachine';
import type { TSessionSnapshot } from '@/index';
import type { TStatusSnapshot, TStatusSnapshotByState } from '../statusSnapshot';

type TCallStatusSnapshotByState<TState extends ECallStatus> = TStatusSnapshotByState<
  TState,
  TContextMap
>;

export type TCallStatusSnapshot = TStatusSnapshot<ECallStatus, TContextMap>;

const withStatusSnapshotViews = <TState extends ECallStatus>(
  base: ReturnType<typeof createStatusStateModel<TState, TContextMap[TState]>>,
) => {
  return base
    .views((self) => {
      return {
        get snapshot(): TCallStatusSnapshotByState<TState> {
          return { state: self.state, context: self.context };
        },
      };
    })
    .views((self) => {
      return {
        isIdle: (): boolean => {
          return self.snapshot.state === ECallStatus.IDLE;
        },
        isConnecting: (): boolean => {
          return self.snapshot.state === ECallStatus.CONNECTING;
        },
        isPresentationCall: (): boolean => {
          return self.snapshot.state === ECallStatus.PRESENTATION_CALL;
        },
        isRoomPendingAuth: (): boolean => {
          return self.snapshot.state === ECallStatus.ROOM_PENDING_AUTH;
        },
        isPurgatory: (): boolean => {
          return self.snapshot.state === ECallStatus.PURGATORY;
        },
        isP2PRoom: (): boolean => {
          return self.snapshot.state === ECallStatus.P2P_ROOM;
        },
        isDirectP2PRoom: (): boolean => {
          return self.snapshot.state === ECallStatus.DIRECT_P2P_ROOM;
        },
        isInRoom: (): boolean => {
          return self.snapshot.state === ECallStatus.IN_ROOM;
        },
        isDisconnecting: (): boolean => {
          return self.snapshot.state === ECallStatus.DISCONNECTING;
        },
      };
    })
    .views((self) => {
      return {
        get hasPendingDisconnect(): true | undefined {
          return getCallContextField(self.context, 'pendingDisconnect');
        },
        get number(): string | undefined {
          return getCallContextField(self.context, 'number');
        },
        get isAnswered(): boolean | undefined {
          return getCallContextField(self.context, 'answer');
        },
        get extraHeaders(): string[] | undefined {
          return getCallContextField(self.context, 'extraHeaders');
        },
        get isConfirmed(): true | undefined {
          return getCallContextField(self.context, 'isConfirmed');
        },
        get room(): string | undefined {
          return getCallContextField(self.context, 'room');
        },
        get participantName(): string | undefined {
          return getCallContextField(self.context, 'participantName');
        },
        get isDirectP2P(): true | undefined {
          return getCallContextField(self.context, 'isDirectPeerToPeer');
        },
        get token(): string | undefined {
          return getCallContextField(self.context, 'token');
        },
        get conferenceForToken(): string | undefined {
          return getCallContextField(self.context, 'conferenceForToken');
        },
      };
    });
};

export function createCallStatusSnapshotFromSession(
  snapshot: TSessionSnapshot,
): TCallStatusSnapshot {
  const {
    call: {
      value: state,
      context: { state: context },
    },
  } = snapshot;

  return {
    state,
    context,
  } as TCallStatusSnapshot;
}

const CallIdleStatusModel = withStatusSnapshotViews(
  createStatusStateModel<ECallStatus.IDLE, TContextMap[ECallStatus.IDLE]>(ECallStatus.IDLE),
);
const CallConnectingStatusModel = withStatusSnapshotViews(
  createStatusStateModel<ECallStatus.CONNECTING, TContextMap[ECallStatus.CONNECTING]>(
    ECallStatus.CONNECTING,
  ),
);
const CallPresentationCallStatusModel = withStatusSnapshotViews(
  createStatusStateModel<ECallStatus.PRESENTATION_CALL, TContextMap[ECallStatus.PRESENTATION_CALL]>(
    ECallStatus.PRESENTATION_CALL,
  ),
);
const CallRoomPendingAuthStatusModel = withStatusSnapshotViews(
  createStatusStateModel<ECallStatus.ROOM_PENDING_AUTH, TContextMap[ECallStatus.ROOM_PENDING_AUTH]>(
    ECallStatus.ROOM_PENDING_AUTH,
  ),
);
const CallPurgatoryStatusModel = withStatusSnapshotViews(
  createStatusStateModel<ECallStatus.PURGATORY, TContextMap[ECallStatus.PURGATORY]>(
    ECallStatus.PURGATORY,
  ),
);
const CallP2PRoomStatusModel = withStatusSnapshotViews(
  createStatusStateModel<ECallStatus.P2P_ROOM, TContextMap[ECallStatus.P2P_ROOM]>(
    ECallStatus.P2P_ROOM,
  ),
);
const CallDirectP2PRoomStatusModel = withStatusSnapshotViews(
  createStatusStateModel<ECallStatus.DIRECT_P2P_ROOM, TContextMap[ECallStatus.DIRECT_P2P_ROOM]>(
    ECallStatus.DIRECT_P2P_ROOM,
  ),
);
const CallInRoomStatusModel = withStatusSnapshotViews(
  createStatusStateModel<ECallStatus.IN_ROOM, TContextMap[ECallStatus.IN_ROOM]>(
    ECallStatus.IN_ROOM,
  ),
);
const CallDisconnectingStatusModel = withStatusSnapshotViews(
  createStatusStateModel<ECallStatus.DISCONNECTING, TContextMap[ECallStatus.DISCONNECTING]>(
    ECallStatus.DISCONNECTING,
  ),
);

export const CallStatusModel = types.union(
  CallIdleStatusModel,
  CallConnectingStatusModel,
  CallPresentationCallStatusModel,
  CallRoomPendingAuthStatusModel,
  CallPurgatoryStatusModel,
  CallP2PRoomStatusModel,
  CallDirectP2PRoomStatusModel,
  CallInRoomStatusModel,
  CallDisconnectingStatusModel,
);

export type TCallStatusInstance = Instance<typeof CallStatusModel>;

export const INITIAL_CALL_STATUS_SNAPSHOT = {
  state: ECallStatus.IDLE,
  context: {},
} as SnapshotIn<typeof CallStatusModel>;
