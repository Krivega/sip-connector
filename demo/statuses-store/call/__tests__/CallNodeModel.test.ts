import { ECallStatus } from '@/index';
import { CallNodeModel, INITIAL_CALL_NODE_SNAPSHOT } from '../CallStatusesNode';

type TCallNodeSnapshot = Parameters<typeof CallNodeModel.create>[0];

const createCallNode = (snapshot: TCallNodeSnapshot = INITIAL_CALL_NODE_SNAPSHOT) => {
  return CallNodeModel.create(snapshot);
};

const getStateFlags = (node: ReturnType<typeof createCallNode>) => {
  return {
    hasIdle: node.hasIdle(),
    hasConnecting: node.hasConnecting(),
    hasPresentationCall: node.hasPresentationCall(),
    hasRoomPendingAuth: node.hasRoomPendingAuth(),
    hasPurgatory: node.hasPurgatory(),
    hasP2PRoom: node.hasP2PRoom(),
    hasDirectP2PRoom: node.hasDirectP2PRoom(),
    hasInRoom: node.hasInRoom(),
    hasDisconnecting: node.hasDisconnecting(),
  };
};

type TStateFlags = ReturnType<typeof getStateFlags>;
type TStateFlagKey = keyof TStateFlags;
type TStateCase = {
  title: string;
  snapshot: TCallNodeSnapshot;
  expectedFlags: TStateFlags;
};

const createExpectedFlags = (activeFlag: TStateFlagKey): TStateFlags => {
  return {
    hasIdle: activeFlag === 'hasIdle',
    hasConnecting: activeFlag === 'hasConnecting',
    hasPresentationCall: activeFlag === 'hasPresentationCall',
    hasRoomPendingAuth: activeFlag === 'hasRoomPendingAuth',
    hasPurgatory: activeFlag === 'hasPurgatory',
    hasP2PRoom: activeFlag === 'hasP2PRoom',
    hasDirectP2PRoom: activeFlag === 'hasDirectP2PRoom',
    hasInRoom: activeFlag === 'hasInRoom',
    hasDisconnecting: activeFlag === 'hasDisconnecting',
  };
};

const getContextAccessors = (node: ReturnType<typeof createCallNode>) => {
  return {
    number: node.number,
    answer: node.answer,
    extraHeaders: node.extraHeaders,
    isConfirmed: node.isConfirmed,
    room: node.room,
    participantName: node.participantName,
    isDirectPeerToPeer: node.isDirectPeerToPeer,
    token: node.token,
    conferenceForToken: node.conferenceForToken,
    pendingDisconnect: node.pendingDisconnect,
  };
};

const stateCases: TStateCase[] = [
  {
    title: 'IDLE',
    snapshot: INITIAL_CALL_NODE_SNAPSHOT,
    expectedFlags: createExpectedFlags('hasIdle'),
  },
  {
    title: 'CONNECTING',
    snapshot: {
      state: ECallStatus.CONNECTING,
      context: {
        number: '100',
        answer: false,
        extraHeaders: ['X-Feature: a'],
        isConfirmed: true,
      },
    } as TCallNodeSnapshot,
    expectedFlags: createExpectedFlags('hasConnecting'),
  },
  {
    title: 'PRESENTATION_CALL',
    snapshot: {
      state: ECallStatus.PRESENTATION_CALL,
      context: {
        number: '200',
        answer: true,
      },
    } as TCallNodeSnapshot,
    expectedFlags: createExpectedFlags('hasPresentationCall'),
  },
  {
    title: 'ROOM_PENDING_AUTH',
    snapshot: {
      state: ECallStatus.ROOM_PENDING_AUTH,
      context: {
        number: '300',
        answer: false,
        room: 'room-300',
        participantName: 'alice',
      },
    } as TCallNodeSnapshot,
    expectedFlags: createExpectedFlags('hasRoomPendingAuth'),
  },
  {
    title: 'PURGATORY',
    snapshot: {
      state: ECallStatus.PURGATORY,
      context: {
        number: '301',
        answer: true,
        room: 'room-301',
        participantName: 'bob',
      },
    } as TCallNodeSnapshot,
    expectedFlags: createExpectedFlags('hasPurgatory'),
  },
  {
    title: 'P2P_ROOM',
    snapshot: {
      state: ECallStatus.P2P_ROOM,
      context: {
        number: '302',
        answer: false,
        room: 'room-302',
        participantName: 'charlie',
      },
    } as TCallNodeSnapshot,
    expectedFlags: createExpectedFlags('hasP2PRoom'),
  },
  {
    title: 'DIRECT_P2P_ROOM',
    snapshot: {
      state: ECallStatus.DIRECT_P2P_ROOM,
      context: {
        number: '303',
        answer: false,
        room: 'room-303',
        participantName: 'diana',
        isDirectPeerToPeer: true,
      },
    } as TCallNodeSnapshot,
    expectedFlags: createExpectedFlags('hasDirectP2PRoom'),
  },
  {
    title: 'IN_ROOM',
    snapshot: {
      state: ECallStatus.IN_ROOM,
      context: {
        number: '300',
        answer: true,
        room: 'room-1',
        participantName: 'alice',
        token: 'jwt',
        conferenceForToken: 'room-1',
      },
    } as TCallNodeSnapshot,
    expectedFlags: createExpectedFlags('hasInRoom'),
  },
  {
    title: 'DISCONNECTING',
    snapshot: {
      state: ECallStatus.DISCONNECTING,
      context: {
        pendingDisconnect: true,
      },
    } as TCallNodeSnapshot,
    expectedFlags: createExpectedFlags('hasDisconnecting'),
  },
];

describe('CallNodeModel', () => {
  it('maps initial snapshot to nodeValue', () => {
    const node = createCallNode();

    expect(node.nodeValue).toEqual({
      state: ECallStatus.IDLE,
      context: {},
    });
  });

  it.each(stateCases)('exposes state flags for $title', ({ snapshot, expectedFlags }) => {
    const node = createCallNode(snapshot);

    expect(getStateFlags(node)).toEqual(expectedFlags);
  });

  it('returns call context fields in CONNECTING state', () => {
    const node = createCallNode({
      state: ECallStatus.CONNECTING,
      context: {
        number: '100',
        answer: false,
        extraHeaders: ['X-Feature: a'],
        isConfirmed: true,
      },
    });

    expect(getContextAccessors(node)).toEqual({
      number: '100',
      answer: false,
      extraHeaders: ['X-Feature: a'],
      isConfirmed: true,
      room: undefined,
      participantName: undefined,
      isDirectPeerToPeer: undefined,
      token: undefined,
      conferenceForToken: undefined,
      pendingDisconnect: undefined,
    });
  });

  it('returns room-related context fields in IN_ROOM state', () => {
    const node = createCallNode({
      state: ECallStatus.IN_ROOM,
      context: {
        number: '300',
        answer: true,
        room: 'room-1',
        participantName: 'alice',
        token: 'jwt',
        conferenceForToken: 'room-1',
      },
    });

    expect(getContextAccessors(node)).toEqual({
      number: '300',
      answer: true,
      extraHeaders: undefined,
      isConfirmed: undefined,
      room: 'room-1',
      participantName: 'alice',
      isDirectPeerToPeer: undefined,
      token: 'jwt',
      conferenceForToken: 'room-1',
      pendingDisconnect: undefined,
    });
  });

  it('returns isDirectPeerToPeer in DIRECT_P2P_ROOM state', () => {
    const node = createCallNode({
      state: ECallStatus.DIRECT_P2P_ROOM,
      context: {
        number: '500',
        answer: false,
        room: 'room-direct',
        participantName: 'eve',
        isDirectPeerToPeer: true,
      },
    });

    expect(getContextAccessors(node)).toEqual({
      number: '500',
      answer: false,
      extraHeaders: undefined,
      isConfirmed: undefined,
      room: 'room-direct',
      participantName: 'eve',
      isDirectPeerToPeer: true,
      token: undefined,
      conferenceForToken: undefined,
      pendingDisconnect: undefined,
    });
  });

  it('returns pendingDisconnect in DISCONNECTING state', () => {
    const node = createCallNode({
      state: ECallStatus.DISCONNECTING,
      context: {
        pendingDisconnect: true,
      },
    });

    expect(getContextAccessors(node)).toEqual({
      number: undefined,
      answer: undefined,
      extraHeaders: undefined,
      isConfirmed: undefined,
      room: undefined,
      participantName: undefined,
      isDirectPeerToPeer: undefined,
      token: undefined,
      conferenceForToken: undefined,
      pendingDisconnect: true,
    });
  });
});
