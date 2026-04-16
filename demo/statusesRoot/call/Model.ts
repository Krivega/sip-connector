import { types } from 'mobx-state-tree';

import { ECallStatus as EState } from '@/index';
import { getCallContextField } from './utils';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TCallContextMap, TCallSnapshot as TSnapshot, TSessionSnapshot } from '@/index';

type TSnapshotByState<TState extends EState> = TState extends EState
  ? Extract<TSnapshot, { value: TState }> extends { context: infer TContext }
    ? { state: TState; context: TContext }
    : never
  : never;

export type TCallStatusSnapshot = TSnapshotByState<EState>;

export const createCallStatusSnapshotFromSession = (
  snapshot: TSessionSnapshot,
): TSnapshotByState<EState> => {
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
};

export const CallStatusModel = types
  .model({
    state: types.enumeration('CallStatus', [
      EState.IDLE,
      EState.CONNECTING,
      EState.PRESENTATION_CALL,
      EState.ROOM_PENDING_AUTH,
      EState.PURGATORY,
      EState.P2P_ROOM,
      EState.DIRECT_P2P_ROOM,
      EState.IN_ROOM,
      EState.DISCONNECTING,
    ]),
    context: types.frozen<TCallContextMap[EState]>(),
  })
  .views((self) => {
    return {
      get snapshot(): TSnapshotByState<EState> {
        return {
          state: self.state,
          context: self.context,
        } as TCallStatusSnapshot;
      },
    };
  })
  .views((self) => {
    return {
      isIdle: (): boolean => {
        return self.state === EState.IDLE;
      },
      isConnecting: (): boolean => {
        return self.state === EState.CONNECTING;
      },
      isPresentationCall: (): boolean => {
        return self.state === EState.PRESENTATION_CALL;
      },
      isRoomPendingAuth: (): boolean => {
        return self.state === EState.ROOM_PENDING_AUTH;
      },
      isPurgatory: (): boolean => {
        return self.state === EState.PURGATORY;
      },
      isP2PRoom: (): boolean => {
        return self.state === EState.P2P_ROOM;
      },
      isDirectP2PRoom: (): boolean => {
        return self.state === EState.DIRECT_P2P_ROOM;
      },
      isInRoom: (): boolean => {
        return self.state === EState.IN_ROOM;
      },
      isDisconnecting: (): boolean => {
        return self.state === EState.DISCONNECTING;
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

export type TCallStatusInstance = Instance<typeof CallStatusModel>;

export const INITIAL_CALL_STATUS_SNAPSHOT = {
  state: EState.IDLE,
  context: {},
} as SnapshotIn<typeof CallStatusModel>;
