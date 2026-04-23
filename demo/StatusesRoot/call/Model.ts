import { types } from 'mobx-state-tree';

import { ECallStatus as EState } from '@/index';
import { getCallContextField } from './utils';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TCallContextMap, TSessionSnapshot } from '@/index';

export type TSnapshotByState<TState extends EState> = {
  state: TState;
  context: TCallContextMap[TState];
};

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
    const hasState = (state: EState): boolean => {
      return self.state === state;
    };

    return {
      isIdle: (): boolean => {
        return hasState(EState.IDLE);
      },
      isConnecting: (): boolean => {
        return hasState(EState.CONNECTING);
      },
      isPresentationCall: (): boolean => {
        return hasState(EState.PRESENTATION_CALL);
      },
      isRoomPendingAuth: (): boolean => {
        return hasState(EState.ROOM_PENDING_AUTH);
      },
      isPurgatory: (): boolean => {
        return hasState(EState.PURGATORY);
      },
      isP2PRoom: (): boolean => {
        return hasState(EState.P2P_ROOM);
      },
      isDirectP2PRoom: (): boolean => {
        return hasState(EState.DIRECT_P2P_ROOM);
      },
      isInRoom: (): boolean => {
        return hasState(EState.IN_ROOM);
      },
      isDisconnecting: (): boolean => {
        return hasState(EState.DISCONNECTING);
      },
    };
  })
  .views((self) => {
    return {
      isP2PCall(): boolean {
        return self.isP2PRoom() || self.isDirectP2PRoom();
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
      get startedTimestamp(): number | undefined {
        return getCallContextField(self.context, 'startedTimestamp');
      },
    };
  })
  .views((self) => {
    return {
      get roomOrTargetRoom(): string | undefined {
        return self.isPurgatory() ? self.number : self.room;
      },
    };
  });

export type TCallStatusInstance = Instance<typeof CallStatusModel>;

export const INITIAL_CALL_STATUS_SNAPSHOT = {
  state: EState.IDLE,
  context: {},
} as SnapshotIn<typeof CallStatusModel>;
