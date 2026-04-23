import { ECallStatus, type TCallContextMap } from '@/index';
import { CallStatusModel, INITIAL_CALL_STATUS_SNAPSHOT } from '../Model';

type TCallSnapshotByState<TState extends ECallStatus> = {
  state: TState;
  context: TCallContextMap[TState];
};

type TCallSnapshot = TCallSnapshotByState<ECallStatus>;

const createSnapshot = <TState extends ECallStatus>(
  state: TState,
  context: TCallContextMap[TState],
): TCallSnapshotByState<TState> => {
  return { state, context };
};

const unsafeSnapshot = (snapshot: unknown): TCallSnapshot => {
  return snapshot as TCallSnapshot;
};

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

/** Согласовано с типом контекста активных состояний CallStateMachine (`startedTimestamp`). */
const MOCK_STARTED_AT = 1_700_000_000_000;

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
    startedTimestamp: status.startedTimestamp,
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
    snapshot: createSnapshot(ECallStatus.CONNECTING, {
      number: '100',
      answer: false,
      extraHeaders: ['X-Feature: a'],
      isConfirmed: true,
    }),
    expectedFlags: createExpectedFlags('isConnecting'),
  },
  {
    title: 'PRESENTATION_CALL',
    snapshot: createSnapshot(ECallStatus.PRESENTATION_CALL, {
      number: '200',
      answer: true,
      startedTimestamp: MOCK_STARTED_AT,
    }),
    expectedFlags: createExpectedFlags('isPresentationCall'),
  },
  {
    title: 'ROOM_PENDING_AUTH',
    snapshot: createSnapshot(ECallStatus.ROOM_PENDING_AUTH, {
      number: '300',
      answer: false,
      room: 'room-300',
      participantName: 'alice',
      startedTimestamp: MOCK_STARTED_AT,
    }),
    expectedFlags: createExpectedFlags('isRoomPendingAuth'),
  },
  {
    title: 'PURGATORY',
    snapshot: createSnapshot(ECallStatus.PURGATORY, {
      number: '301',
      answer: true,
      room: 'room-301',
      participantName: 'bob',
      startedTimestamp: MOCK_STARTED_AT,
    }),
    expectedFlags: createExpectedFlags('isPurgatory'),
  },
  {
    title: 'P2P_ROOM',
    snapshot: createSnapshot(ECallStatus.P2P_ROOM, {
      number: '302',
      answer: false,
      room: 'room-302',
      participantName: 'charlie',
      startedTimestamp: MOCK_STARTED_AT,
    }),
    expectedFlags: createExpectedFlags('isP2PRoom'),
  },
  {
    title: 'DIRECT_P2P_ROOM',
    snapshot: createSnapshot(ECallStatus.DIRECT_P2P_ROOM, {
      number: '303',
      answer: false,
      room: 'room-303',
      participantName: 'diana',
      isDirectPeerToPeer: true,
      startedTimestamp: MOCK_STARTED_AT,
    }),
    expectedFlags: createExpectedFlags('isDirectP2PRoom'),
  },
  {
    title: 'IN_ROOM',
    snapshot: createSnapshot(ECallStatus.IN_ROOM, {
      number: '300',
      answer: true,
      room: 'room-1',
      participantName: 'alice',
      startedTimestamp: MOCK_STARTED_AT,
      token: 'jwt',
      conferenceForToken: 'room-1',
    }),
    expectedFlags: createExpectedFlags('isInRoom'),
  },
  {
    title: 'DISCONNECTING',
    snapshot: createSnapshot(ECallStatus.DISCONNECTING, {
      pendingDisconnect: true,
    }),
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
      snapshot: createSnapshot(ECallStatus.P2P_ROOM, {
        number: '302',
        answer: false,
        room: 'room-302',
        participantName: 'charlie',
        startedTimestamp: MOCK_STARTED_AT,
      }),
      expected: true,
    },
    {
      title: 'DIRECT_P2P_ROOM',
      snapshot: createSnapshot(ECallStatus.DIRECT_P2P_ROOM, {
        number: '303',
        answer: false,
        room: 'room-303',
        participantName: 'diana',
        isDirectPeerToPeer: true,
        startedTimestamp: MOCK_STARTED_AT,
      }),
      expected: true,
    },
    {
      title: 'IN_ROOM',
      snapshot: createSnapshot(ECallStatus.IN_ROOM, {
        number: '300',
        answer: true,
        room: 'room-1',
        participantName: 'alice',
        startedTimestamp: MOCK_STARTED_AT,
        token: 'jwt',
        conferenceForToken: 'room-1',
      }),
      expected: false,
    },
    {
      title: 'PURGATORY',
      snapshot: createSnapshot(ECallStatus.PURGATORY, {
        number: '301',
        answer: true,
        room: 'room-301',
        participantName: 'bob',
        startedTimestamp: MOCK_STARTED_AT,
      }),
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
      snapshot: createSnapshot(ECallStatus.PURGATORY, {
        number: '301',
        answer: true,
        room: 'room-301',
        participantName: 'bob',
        startedTimestamp: MOCK_STARTED_AT,
      }),
      expected: '301',
    },
    {
      title: 'IDLE returns undefined',
      snapshot: INITIAL_CALL_STATUS_SNAPSHOT,
      expected: undefined,
    },
    {
      title: 'IN_ROOM uses room',
      snapshot: createSnapshot(ECallStatus.IN_ROOM, {
        number: '300',
        answer: true,
        room: 'room-1',
        participantName: 'alice',
        startedTimestamp: MOCK_STARTED_AT,
        token: 'jwt',
        conferenceForToken: 'room-1',
      }),
      expected: 'room-1',
    },
    {
      title: 'CONNECTING without room returns undefined',
      snapshot: createSnapshot(ECallStatus.CONNECTING, {
        number: '100',
        answer: false,
      }),
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
      startedTimestamp: undefined,
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
        startedTimestamp: MOCK_STARTED_AT,
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
      startedTimestamp: MOCK_STARTED_AT,
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
        startedTimestamp: MOCK_STARTED_AT,
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
      startedTimestamp: MOCK_STARTED_AT,
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
      startedTimestamp: undefined,
    });
  });

  describe('runtime negative cases (unsafe cast)', () => {
    it.each([
      {
        title: 'P2P_ROOM with empty context still treated as p2p',
        snapshot: unsafeSnapshot({
          state: ECallStatus.P2P_ROOM,
          context: {},
        }),
        expected: true,
      },
      {
        title: 'DIRECT_P2P_ROOM with partial context still treated as p2p',
        snapshot: unsafeSnapshot({
          state: ECallStatus.DIRECT_P2P_ROOM,
          context: {
            isDirectPeerToPeer: true,
          },
        }),
        expected: true,
      },
    ])('returns $expected for isP2PCall when $title', ({ snapshot, expected }) => {
      const status = createCallStatus(snapshot);

      expect(status.isP2PCall()).toBe(expected);
    });

    it('returns undefined roomOrTargetRoom for invalid PURGATORY context', () => {
      const status = createCallStatus(
        unsafeSnapshot({
          state: ECallStatus.PURGATORY,
          context: {
            room: 'room-invalid',
          },
        }),
      );

      expect(status.roomOrTargetRoom).toBeUndefined();
    });
  });
});
