export enum EState {
  IDLE = 'call:idle',
  CONNECTING = 'call:connecting',
  PRESENTATION_CALL = 'call:presentationCall',
  ROOM_PENDING_AUTH = 'call:roomPendingAuth',
  PURGATORY = 'call:purgatory',
  P2P_ROOM = 'call:p2pRoom',
  DIRECT_P2P_ROOM = 'call:directP2pRoom',
  IN_ROOM = 'call:inRoom',
  DISCONNECTING = 'call:disconnecting',
}

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
