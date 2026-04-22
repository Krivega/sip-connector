import { ECallStatus } from '@/index';

export const idleCallState = {
  value: ECallStatus.IDLE,
  context: {},
} as const;

export const connectingCallState = {
  value: ECallStatus.CONNECTING,
  context: { number: '1000', answer: false },
} as const;

export const presentationCallState = {
  value: ECallStatus.PRESENTATION_CALL,
  context: { number: '2000', answer: true },
} as const;

export const disconnectingCallState = {
  value: ECallStatus.DISCONNECTING,
  context: {},
} as const;

const baseRoomContext = {
  number: 'room',
  answer: true,
  room: 'room',
  participantName: 'participantName',
};

export const purgatoryCallState = {
  value: ECallStatus.PURGATORY,
  context: {
    ...baseRoomContext,
    number: 'purgatory',
    room: 'purgatory',
  },
};

export const roomPendingAuthCallState = {
  value: ECallStatus.ROOM_PENDING_AUTH,
  context: {
    ...baseRoomContext,
    number: 'roomPendingAuth',
    room: 'roomPendingAuth',
  },
};

export const p2pRoomCallState = {
  value: ECallStatus.P2P_ROOM,
  context: { ...baseRoomContext },
};

export const directP2PRoomCallState = {
  value: ECallStatus.DIRECT_P2P_ROOM,
  context: { ...baseRoomContext },
};

export const inRoomCallState = {
  value: ECallStatus.IN_ROOM,
  context: {
    ...baseRoomContext,
    token: 't',
    participantName: 'participantName-id',
  },
};

export const p2pRoomContext = {
  number: '200',
  answer: false,
  room: 'p2p-room',
  participantName: 'Participant',
};

export const p2pRoomP2PContextCallState = {
  value: ECallStatus.P2P_ROOM,
  context: p2pRoomContext,
};

export const directP2PRoomP2PContextCallState = {
  value: ECallStatus.DIRECT_P2P_ROOM,
  context: p2pRoomContext,
};

export type TRoomContext = typeof baseRoomContext;
export type TInRoomContext = typeof inRoomCallState.context;
