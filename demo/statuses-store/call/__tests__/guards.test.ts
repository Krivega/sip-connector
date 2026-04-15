import { ECallStatus } from '@/index';
import {
  isCallNodeState,
  isConnectingCallNode,
  isDirectP2PRoomCallNode,
  isDisconnectingCallNode,
  isIdleCallNode,
  isInRoomCallNode,
  isP2PRoomCallNode,
  isPresentationCallNode,
  isPurgatoryCallNode,
  isRoomPendingAuthCallNode,
} from '../guards';

const expectType = <T>(value: T): T => {
  return value;
};

const stateGuards = {
  isIdleCallNode,
  isConnectingCallNode,
  isPresentationCallNode,
  isRoomPendingAuthCallNode,
  isPurgatoryCallNode,
  isP2PRoomCallNode,
  isDirectP2PRoomCallNode,
  isInRoomCallNode,
  isDisconnectingCallNode,
} as const;

type TGuardName = keyof typeof stateGuards;

type TRuntimeNode = {
  state: ECallStatus;
  context: unknown;
};

type TCase = {
  title: string;
  value: TRuntimeNode;
  expectedGuard: TGuardName;
};

const runtimeCases: TCase[] = [
  {
    title: 'IDLE',
    value: { state: ECallStatus.IDLE, context: {} },
    expectedGuard: 'isIdleCallNode',
  },
  {
    title: 'CONNECTING',
    value: { state: ECallStatus.CONNECTING, context: { number: '100', answer: false } },
    expectedGuard: 'isConnectingCallNode',
  },
  {
    title: 'PRESENTATION_CALL',
    value: { state: ECallStatus.PRESENTATION_CALL, context: { number: '101', answer: true } },
    expectedGuard: 'isPresentationCallNode',
  },
  {
    title: 'ROOM_PENDING_AUTH',
    value: {
      state: ECallStatus.ROOM_PENDING_AUTH,
      context: { number: '102', answer: false, room: 'room-102', participantName: 'alice' },
    },
    expectedGuard: 'isRoomPendingAuthCallNode',
  },
  {
    title: 'PURGATORY',
    value: {
      state: ECallStatus.PURGATORY,
      context: { number: '103', answer: true, room: 'room-103', participantName: 'bob' },
    },
    expectedGuard: 'isPurgatoryCallNode',
  },
  {
    title: 'P2P_ROOM',
    value: {
      state: ECallStatus.P2P_ROOM,
      context: { number: '104', answer: false, room: 'room-104', participantName: 'charlie' },
    },
    expectedGuard: 'isP2PRoomCallNode',
  },
  {
    title: 'DIRECT_P2P_ROOM',
    value: {
      state: ECallStatus.DIRECT_P2P_ROOM,
      context: {
        number: '105',
        answer: false,
        room: 'room-105',
        participantName: 'diana',
        isDirectPeerToPeer: true,
      },
    },
    expectedGuard: 'isDirectP2PRoomCallNode',
  },
  {
    title: 'IN_ROOM',
    value: {
      state: ECallStatus.IN_ROOM,
      context: {
        number: '106',
        answer: true,
        room: 'room-106',
        participantName: 'eve',
        token: 'jwt',
        conferenceForToken: 'room-106',
      },
    },
    expectedGuard: 'isInRoomCallNode',
  },
  {
    title: 'DISCONNECTING',
    value: { state: ECallStatus.DISCONNECTING, context: {} },
    expectedGuard: 'isDisconnectingCallNode',
  },
];

describe('CallNode guards', () => {
  it.each(runtimeCases)('detects $title with generic isCallNodeState', ({ value }) => {
    expect(isCallNodeState(value, value.state)).toBe(true);
    expect(isCallNodeState(value, ECallStatus.IDLE)).toBe(value.state === ECallStatus.IDLE);
  });

  it.each(runtimeCases)('runs all per-state guards for $title', ({ value, expectedGuard }) => {
    (Object.entries(stateGuards) as [TGuardName, (node: TRuntimeNode) => boolean][]).forEach(
      ([guardName, guard]) => {
        expect(guard(value)).toBe(guardName === expectedGuard);
      },
    );
  });

  it('narrows types at compile time via all guards', () => {
    type TRoomBase = {
      number: string;
      answer: boolean;
      room: string;
      participantName: string;
    };

    type TGuardCandidate =
      | { state: ECallStatus.IDLE; context: { pendingDisconnect?: true } }
      | { state: ECallStatus.CONNECTING; context: { number: string; answer: boolean } }
      | { state: ECallStatus.PRESENTATION_CALL; context: { number: string; answer: boolean } }
      | { state: ECallStatus.ROOM_PENDING_AUTH; context: TRoomBase }
      | { state: ECallStatus.PURGATORY; context: TRoomBase }
      | { state: ECallStatus.P2P_ROOM; context: TRoomBase }
      | {
          state: ECallStatus.DIRECT_P2P_ROOM;
          context: TRoomBase & { isDirectPeerToPeer: true };
        }
      | {
          state: ECallStatus.IN_ROOM;
          context: TRoomBase & { token: string; conferenceForToken: string };
        }
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      | { state: ECallStatus.DISCONNECTING; context: {} };

    const assertNarrowing = (candidate: TGuardCandidate) => {
      if (isIdleCallNode(candidate)) {
        expectType<Extract<TGuardCandidate, { state: ECallStatus.IDLE }>>(candidate);
        expectType<true | undefined>(candidate.context.pendingDisconnect);
      }

      if (isConnectingCallNode(candidate)) {
        expectType<Extract<TGuardCandidate, { state: ECallStatus.CONNECTING }>>(candidate);
        expectType<string>(candidate.context.number);
      }

      if (isPresentationCallNode(candidate)) {
        expectType<Extract<TGuardCandidate, { state: ECallStatus.PRESENTATION_CALL }>>(candidate);
        expectType<boolean>(candidate.context.answer);
      }

      if (isRoomPendingAuthCallNode(candidate)) {
        expectType<Extract<TGuardCandidate, { state: ECallStatus.ROOM_PENDING_AUTH }>>(candidate);
        expectType<string>(candidate.context.room);
      }

      if (isPurgatoryCallNode(candidate)) {
        expectType<Extract<TGuardCandidate, { state: ECallStatus.PURGATORY }>>(candidate);
        expectType<string>(candidate.context.participantName);
      }

      if (isP2PRoomCallNode(candidate)) {
        expectType<Extract<TGuardCandidate, { state: ECallStatus.P2P_ROOM }>>(candidate);
        expectType<string>(candidate.context.number);
      }

      if (isDirectP2PRoomCallNode(candidate)) {
        expectType<Extract<TGuardCandidate, { state: ECallStatus.DIRECT_P2P_ROOM }>>(candidate);
        expectType<true>(candidate.context.isDirectPeerToPeer);
      }

      if (isInRoomCallNode(candidate)) {
        expectType<Extract<TGuardCandidate, { state: ECallStatus.IN_ROOM }>>(candidate);
        expectType<string>(candidate.context.token);
        expectType<string>(candidate.context.conferenceForToken);
      }

      if (isDisconnectingCallNode(candidate)) {
        expectType<Extract<TGuardCandidate, { state: ECallStatus.DISCONNECTING }>>(candidate);
        expectType<object>(candidate.context);
      }
    };

    const sample: TGuardCandidate = {
      state: ECallStatus.DIRECT_P2P_ROOM,
      context: {
        number: '200',
        answer: false,
        room: 'room-200',
        participantName: 'sample',
        isDirectPeerToPeer: true,
      },
    };

    assertNarrowing(sample);
    expect(true).toBe(true);
  });
});
