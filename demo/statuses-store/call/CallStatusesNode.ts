import { types } from 'mobx-state-tree';

import { ECallStatus } from '@/index';
import { createNodeModel } from '../createNodeModel';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TSessionSnapshot } from '@/index';

export type TCallNodeValue = {
  [TState in ECallStatus]: {
    state: TState;
    context: Extract<TSessionSnapshot['call'], { value: TState }>['context']['state'];
  };
}[ECallStatus];

type TCallContextProperties = {
  pendingDisconnect?: true;
  number?: string;
  answer?: boolean;
  extraHeaders?: string[];
  isConfirmed?: true;
  room?: string;
  participantName?: string;
  isDirectPeerToPeer?: true;
  token?: string;
  conferenceForToken?: string;
};

const getContextProperty = <K extends keyof TCallContextProperties>(
  context: unknown,
  key: K,
): TCallContextProperties[K] | undefined => {
  if (typeof context !== 'object' || context === null || !(key in context)) {
    return undefined;
  }

  return (context as TCallContextProperties)[key];
};

const withNodeValueViews = <S extends string, C>(
  base: ReturnType<typeof createNodeModel<S, C>>,
) => {
  return base
    .views((self) => {
      return {
        get nodeValue(): TCallNodeValue {
          return { state: self.state, context: self.context } as TCallNodeValue;
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
  return {
    state: snapshot.call.value,
    context: snapshot.call.context.state,
  } as TCallNodeValue;
}

const CallIdleNodeModel = withNodeValueViews(
  createNodeModel<
    ECallStatus.IDLE,
    Extract<TSessionSnapshot['call'], { value: ECallStatus.IDLE }>['context']['state']
  >(ECallStatus.IDLE),
);
const CallConnectingNodeModel = withNodeValueViews(
  createNodeModel<
    ECallStatus.CONNECTING,
    Extract<TSessionSnapshot['call'], { value: ECallStatus.CONNECTING }>['context']['state']
  >(ECallStatus.CONNECTING),
);
const CallPresentationCallNodeModel = withNodeValueViews(
  createNodeModel<
    ECallStatus.PRESENTATION_CALL,
    Extract<TSessionSnapshot['call'], { value: ECallStatus.PRESENTATION_CALL }>['context']['state']
  >(ECallStatus.PRESENTATION_CALL),
);
const CallRoomPendingAuthNodeModel = withNodeValueViews(
  createNodeModel<
    ECallStatus.ROOM_PENDING_AUTH,
    Extract<TSessionSnapshot['call'], { value: ECallStatus.ROOM_PENDING_AUTH }>['context']['state']
  >(ECallStatus.ROOM_PENDING_AUTH),
);
const CallPurgatoryNodeModel = withNodeValueViews(
  createNodeModel<
    ECallStatus.PURGATORY,
    Extract<TSessionSnapshot['call'], { value: ECallStatus.PURGATORY }>['context']['state']
  >(ECallStatus.PURGATORY),
);
const CallP2PRoomNodeModel = withNodeValueViews(
  createNodeModel<
    ECallStatus.P2P_ROOM,
    Extract<TSessionSnapshot['call'], { value: ECallStatus.P2P_ROOM }>['context']['state']
  >(ECallStatus.P2P_ROOM),
);
const CallDirectP2PRoomNodeModel = withNodeValueViews(
  createNodeModel<
    ECallStatus.DIRECT_P2P_ROOM,
    Extract<TSessionSnapshot['call'], { value: ECallStatus.DIRECT_P2P_ROOM }>['context']['state']
  >(ECallStatus.DIRECT_P2P_ROOM),
);
const CallInRoomNodeModel = withNodeValueViews(
  createNodeModel<
    ECallStatus.IN_ROOM,
    Extract<TSessionSnapshot['call'], { value: ECallStatus.IN_ROOM }>['context']['state']
  >(ECallStatus.IN_ROOM),
);
const CallDisconnectingNodeModel = withNodeValueViews(
  createNodeModel<
    ECallStatus.DISCONNECTING,
    Extract<TSessionSnapshot['call'], { value: ECallStatus.DISCONNECTING }>['context']['state']
  >(ECallStatus.DISCONNECTING),
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
