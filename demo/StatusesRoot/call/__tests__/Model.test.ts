import { ECallStatus } from '@/index';
import { CallStatusModel, INITIAL_CALL_STATUS_SNAPSHOT } from '../Model';

type TCallSnapshot = Parameters<typeof CallStatusModel.create>[0];

const createCallStatus = (snapshot: TCallSnapshot = INITIAL_CALL_STATUS_SNAPSHOT) => {
  return CallStatusModel.create(snapshot);
};

const getStateFlags = (status: ReturnType<typeof createCallStatus>) => {
  return {
    isIdle: status.isIdle(),
    isConnecting: status.isConnecting(),
    isPresentationCall: status.isPresentationCall(),
    isRoomPendingAuth: status.isRoomPendingAuth(),
    isPurgatory: status.isPurgatory(),
    isP2PRoom: status.isP2PRoom(),
    isDirectP2PRoom: status.isDirectP2PRoom(),
    isInRoom: status.isInRoom(),
    isDisconnecting: status.isDisconnecting(),
  };
};

type TStateFlags = ReturnType<typeof getStateFlags>;
type TStateFlagKey = keyof TStateFlags;
type TStateCase = {
  title: string;
  snapshot: TCallSnapshot;
  expectedFlags: TStateFlags;
};

const createExpectedFlags = (activeFlag: TStateFlagKey): TStateFlags => {
  return {
    isIdle: activeFlag === 'isIdle',
    isConnecting: activeFlag === 'isConnecting',
    isPresentationCall: activeFlag === 'isPresentationCall',
    isRoomPendingAuth: activeFlag === 'isRoomPendingAuth',
    isPurgatory: activeFlag === 'isPurgatory',
    isP2PRoom: activeFlag === 'isP2PRoom',
    isDirectP2PRoom: activeFlag === 'isDirectP2PRoom',
    isInRoom: activeFlag === 'isInRoom',
    isDisconnecting: activeFlag === 'isDisconnecting',
  };
};

const getContextAccessors = (status: ReturnType<typeof createCallStatus>) => {
  return {
    number: status.number,
    isAnswered: status.isAnswered,
    extraHeaders: status.extraHeaders,
    isConfirmed: status.isConfirmed,
    room: status.room,
    participantName: status.participantName,
    isDirectP2P: status.isDirectP2P,
    token: status.token,
    conferenceForToken: status.conferenceForToken,
    hasPendingDisconnect: status.hasPendingDisconnect,
  };
};

const stateCases: TStateCase[] = [
  {
    title: 'IDLE',
    snapshot: INITIAL_CALL_STATUS_SNAPSHOT,
    expectedFlags: createExpectedFlags('isIdle'),
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
    } as TCallSnapshot,
    expectedFlags: createExpectedFlags('isConnecting'),
  },
  {
    title: 'PRESENTATION_CALL',
    snapshot: {
      state: ECallStatus.PRESENTATION_CALL,
      context: {
        number: '200',
        answer: true,
      },
    } as TCallSnapshot,
    expectedFlags: createExpectedFlags('isPresentationCall'),
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
    } as TCallSnapshot,
    expectedFlags: createExpectedFlags('isRoomPendingAuth'),
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
    } as TCallSnapshot,
    expectedFlags: createExpectedFlags('isPurgatory'),
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
    } as TCallSnapshot,
    expectedFlags: createExpectedFlags('isP2PRoom'),
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
    } as TCallSnapshot,
    expectedFlags: createExpectedFlags('isDirectP2PRoom'),
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
    } as TCallSnapshot,
    expectedFlags: createExpectedFlags('isInRoom'),
  },
  {
    title: 'DISCONNECTING',
    snapshot: {
      state: ECallStatus.DISCONNECTING,
      context: {
        pendingDisconnect: true,
      },
    } as TCallSnapshot,
    expectedFlags: createExpectedFlags('isDisconnecting'),
  },
];

describe('CallStatusModel', () => {
  it('maps initial snapshot to snapshot', () => {
    const status = createCallStatus();

    expect(status.snapshot).toEqual({
      state: ECallStatus.IDLE,
      context: {},
    });
  });

  it.each(stateCases)('exposes state flags for $title', ({ snapshot, expectedFlags }) => {
    const status = createCallStatus(snapshot);

    expect(getStateFlags(status)).toEqual(expectedFlags);
  });

  it.each([
    {
      title: 'P2P_ROOM',
      snapshot: {
        state: ECallStatus.P2P_ROOM,
        context: {},
      } as TCallSnapshot,
      expected: true,
    },
    {
      title: 'DIRECT_P2P_ROOM',
      snapshot: {
        state: ECallStatus.DIRECT_P2P_ROOM,
        context: {
          isDirectPeerToPeer: true,
        },
      } as TCallSnapshot,
      expected: true,
    },
    {
      title: 'IN_ROOM',
      snapshot: {
        state: ECallStatus.IN_ROOM,
        context: {},
      } as TCallSnapshot,
      expected: false,
    },
    {
      title: 'PURGATORY',
      snapshot: {
        state: ECallStatus.PURGATORY,
        context: {},
      } as TCallSnapshot,
      expected: false,
    },
    {
      title: 'IDLE',
      snapshot: INITIAL_CALL_STATUS_SNAPSHOT,
      expected: false,
    },
  ])('returns $expected for isP2PCall() in $title', ({ snapshot, expected }) => {
    const status = createCallStatus(snapshot);

    expect(status.isP2PCall()).toBe(expected);
  });

  it.each([
    {
      title: 'PURGATORY uses number',
      snapshot: {
        state: ECallStatus.PURGATORY,
        context: {
          number: '301',
          room: 'room-301',
        },
      } as TCallSnapshot,
      expected: '301',
    },
    {
      title: 'PURGATORY without number returns undefined',
      snapshot: {
        state: ECallStatus.PURGATORY,
        context: {
          room: 'room-301',
        },
      } as TCallSnapshot,
      expected: undefined,
    },
    {
      title: 'IN_ROOM uses room',
      snapshot: {
        state: ECallStatus.IN_ROOM,
        context: {
          number: '300',
          room: 'room-1',
        },
      } as TCallSnapshot,
      expected: 'room-1',
    },
    {
      title: 'CONNECTING without room returns undefined',
      snapshot: {
        state: ECallStatus.CONNECTING,
        context: {
          number: '100',
        },
      } as TCallSnapshot,
      expected: undefined,
    },
  ])('returns $expected for roomOrTargetRoom when $title', ({ snapshot, expected }) => {
    const status = createCallStatus(snapshot);

    expect(status.roomOrTargetRoom).toBe(expected);
  });

  it('returns call context fields in CONNECTING state', () => {
    const status = createCallStatus({
      state: ECallStatus.CONNECTING,
      context: {
        number: '100',
        answer: false,
        extraHeaders: ['X-Feature: a'],
        isConfirmed: true,
      },
    });

    expect(getContextAccessors(status)).toEqual({
      number: '100',
      isAnswered: false,
      extraHeaders: ['X-Feature: a'],
      isConfirmed: true,
      room: undefined,
      participantName: undefined,
      isDirectP2P: undefined,
      token: undefined,
      conferenceForToken: undefined,
      hasPendingDisconnect: undefined,
    });
  });

  it('returns room-related context fields in IN_ROOM state', () => {
    const status = createCallStatus({
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

    expect(getContextAccessors(status)).toEqual({
      number: '300',
      isAnswered: true,
      extraHeaders: undefined,
      isConfirmed: undefined,
      room: 'room-1',
      participantName: 'alice',
      isDirectP2P: undefined,
      token: 'jwt',
      conferenceForToken: 'room-1',
      hasPendingDisconnect: undefined,
    });
  });

  it('returns isDirectP2P in DIRECT_P2P_ROOM state', () => {
    const status = createCallStatus({
      state: ECallStatus.DIRECT_P2P_ROOM,
      context: {
        number: '500',
        answer: false,
        room: 'room-direct',
        participantName: 'eve',
        isDirectPeerToPeer: true,
      },
    });

    expect(getContextAccessors(status)).toEqual({
      number: '500',
      isAnswered: false,
      extraHeaders: undefined,
      isConfirmed: undefined,
      room: 'room-direct',
      participantName: 'eve',
      isDirectP2P: true,
      token: undefined,
      conferenceForToken: undefined,
      hasPendingDisconnect: undefined,
    });
  });

  it('returns hasPendingDisconnect in DISCONNECTING state', () => {
    const status = createCallStatus({
      state: ECallStatus.DISCONNECTING,
      context: {
        pendingDisconnect: true,
      },
    });

    expect(getContextAccessors(status)).toEqual({
      number: undefined,
      isAnswered: undefined,
      extraHeaders: undefined,
      isConfirmed: undefined,
      room: undefined,
      participantName: undefined,
      isDirectP2P: undefined,
      token: undefined,
      conferenceForToken: undefined,
      hasPendingDisconnect: true,
    });
  });
});
