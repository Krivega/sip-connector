import type { EState } from './constants';

export type TAnyRoomState = {
  number: string;
  answer: boolean;
  room: string;
  participantName: string;
};

export type TContextMap = {
  [EState.IDLE]: { pendingDisconnect?: true };
  [EState.CONNECTING]: {
    number: string;
    answer: boolean;
    extraHeaders?: string[];
    isConfirmed?: true;
  };
  [EState.PRESENTATION_CALL]: {
    number: string;
    answer: boolean;
  };
  [EState.ROOM_PENDING_AUTH]: TAnyRoomState;
  [EState.PURGATORY]: TAnyRoomState;
  [EState.P2P_ROOM]: TAnyRoomState;
  [EState.DIRECT_P2P_ROOM]: TAnyRoomState & { isDirectPeerToPeer: true };
  [EState.IN_ROOM]: TAnyRoomState & { token: string; conferenceForToken: string };
};

export type TBaseContext = TContextMap[keyof TContextMap];
export type TContext = {
  raw: TBaseContext;
  state: TBaseContext;
};
