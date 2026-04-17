import { ECallStatus } from '@/index';
import {
  isCallInState,
  isConnectingCall,
  isDirectP2PRoomCall,
  isDisconnectingCall,
  isIdleCall,
  isInRoomCall,
  isP2PRoomCall,
  isPresentationCall,
  isPurgatoryCall,
  isRoomPendingAuthCall,
} from '../guards';

const expectType = <T>(value: T): T => {
  return value;
};

const stateGuards = {
  isIdleCall,
  isConnectingCall,
  isPresentationCall,
  isRoomPendingAuthCall,
  isPurgatoryCall,
  isP2PRoomCall,
  isDirectP2PRoomCall,
  isInRoomCall,
  isDisconnectingCall,
} as const;

type TGuardName = keyof typeof stateGuards;

type TRuntimeInstance = {
  state: ECallStatus;
  context: unknown;
};

type TCase = {
  title: string;
  value: TRuntimeInstance;
  expectedGuard: TGuardName;
};

const runtimeCases: TCase[] = [
  {
    title: 'IDLE',
    value: { state: ECallStatus.IDLE, context: {} },
    expectedGuard: 'isIdleCall',
  },
  {
    title: 'CONNECTING',
    value: { state: ECallStatus.CONNECTING, context: { number: '100', answer: false } },
    expectedGuard: 'isConnectingCall',
  },
  {
    title: 'PRESENTATION_CALL',
    value: { state: ECallStatus.PRESENTATION_CALL, context: { number: '101', answer: true } },
    expectedGuard: 'isPresentationCall',
  },
  {
    title: 'ROOM_PENDING_AUTH',
    value: {
      state: ECallStatus.ROOM_PENDING_AUTH,
      context: { number: '102', answer: false, room: 'room-102', participantName: 'alice' },
    },
    expectedGuard: 'isRoomPendingAuthCall',
  },
  {
    title: 'PURGATORY',
    value: {
      state: ECallStatus.PURGATORY,
      context: { number: '103', answer: true, room: 'room-103', participantName: 'bob' },
    },
    expectedGuard: 'isPurgatoryCall',
  },
  {
    title: 'P2P_ROOM',
    value: {
      state: ECallStatus.P2P_ROOM,
      context: { number: '104', answer: false, room: 'room-104', participantName: 'charlie' },
    },
    expectedGuard: 'isP2PRoomCall',
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
    expectedGuard: 'isDirectP2PRoomCall',
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
    expectedGuard: 'isInRoomCall',
  },
  {
    title: 'DISCONNECTING',
    value: { state: ECallStatus.DISCONNECTING, context: {} },
    expectedGuard: 'isDisconnectingCall',
  },
];

describe('CallStatus guards', () => {
  it.each(runtimeCases)('detects $title with generic isCallInState', ({ value }) => {
    expect(isCallInState(value, value.state)).toBe(true);
    expect(isCallInState(value, ECallStatus.IDLE)).toBe(value.state === ECallStatus.IDLE);
  });

  it.each(runtimeCases)('runs all per-state guards for $title', ({ value, expectedGuard }) => {
    (
      Object.entries(stateGuards) as [TGuardName, (instance: TRuntimeInstance) => boolean][]
    ).forEach(([guardName, guard]) => {
      expect(guard(value)).toBe(guardName === expectedGuard);
    });
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
      if (isIdleCall(candidate)) {
        expectType<Extract<TGuardCandidate, { state: ECallStatus.IDLE }>>(candidate);
        expectType<true | undefined>(candidate.context.pendingDisconnect);
      }

      if (isConnectingCall(candidate)) {
        expectType<Extract<TGuardCandidate, { state: ECallStatus.CONNECTING }>>(candidate);
        expectType<string>(candidate.context.number);
      }

      if (isPresentationCall(candidate)) {
        expectType<Extract<TGuardCandidate, { state: ECallStatus.PRESENTATION_CALL }>>(candidate);
        expectType<boolean>(candidate.context.answer);
      }

      if (isRoomPendingAuthCall(candidate)) {
        expectType<Extract<TGuardCandidate, { state: ECallStatus.ROOM_PENDING_AUTH }>>(candidate);
        expectType<string>(candidate.context.room);
      }

      if (isPurgatoryCall(candidate)) {
        expectType<Extract<TGuardCandidate, { state: ECallStatus.PURGATORY }>>(candidate);
        expectType<string>(candidate.context.participantName);
      }

      if (isP2PRoomCall(candidate)) {
        expectType<Extract<TGuardCandidate, { state: ECallStatus.P2P_ROOM }>>(candidate);
        expectType<string>(candidate.context.number);
      }

      if (isDirectP2PRoomCall(candidate)) {
        expectType<Extract<TGuardCandidate, { state: ECallStatus.DIRECT_P2P_ROOM }>>(candidate);
        expectType<true>(candidate.context.isDirectPeerToPeer);
      }

      if (isInRoomCall(candidate)) {
        expectType<Extract<TGuardCandidate, { state: ECallStatus.IN_ROOM }>>(candidate);
        expectType<string>(candidate.context.token);
        expectType<string>(candidate.context.conferenceForToken);
      }

      if (isDisconnectingCall(candidate)) {
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
