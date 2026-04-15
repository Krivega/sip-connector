import { ECallStatus } from '@/index';
import { CallNodeModel, INITIAL_CALL_NODE_SNAPSHOT } from '../CallStatusesNode';
import {
  isCallNodeState,
  isConnectingCallNode,
  isDisconnectingCallNode,
  isIdleCallNode,
  isInRoomCallNode,
} from '../guards';

const expectType = <T>(value: T): T => {
  return value;
};

describe('CallNodeModel', () => {
  it('maps initial snapshot and exposes IDLE state helpers', () => {
    const node = CallNodeModel.create(INITIAL_CALL_NODE_SNAPSHOT);

    expect(node.nodeValue).toEqual({
      state: ECallStatus.IDLE,
      context: {},
    });
    expect(node.hasIdle()).toBe(true);
    expect(node.hasConnecting()).toBe(false);
    expect(node.hasInRoom()).toBe(false);

    expect(node.number).toBeUndefined();
    expect(node.answer).toBeUndefined();
    expect(node.room).toBeUndefined();
    expect(node.token).toBeUndefined();
    expect(node.conferenceForToken).toBeUndefined();
  });

  it('returns call context fields in CONNECTING state', () => {
    const node = CallNodeModel.create({
      state: ECallStatus.CONNECTING,
      context: {
        number: '100',
        answer: false,
        extraHeaders: ['X-Feature: a'],
        isConfirmed: true,
      },
    });

    expect(node.hasConnecting()).toBe(true);
    expect(node.hasIdle()).toBe(false);
    expect(node.number).toBe('100');
    expect(node.answer).toBe(false);
    expect(node.extraHeaders).toEqual(['X-Feature: a']);
    expect(node.isConfirmed).toBe(true);
    expect(node.room).toBeUndefined();
    expect(node.token).toBeUndefined();
  });

  it('returns room-related context fields in IN_ROOM state', () => {
    const node = CallNodeModel.create({
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

    expect(node.hasInRoom()).toBe(true);
    expect(node.number).toBe('300');
    expect(node.answer).toBe(true);
    expect(node.room).toBe('room-1');
    expect(node.participantName).toBe('alice');
    expect(node.token).toBe('jwt');
    expect(node.conferenceForToken).toBe('room-1');
    expect(node.pendingDisconnect).toBeUndefined();
  });

  it('returns pendingDisconnect in DISCONNECTING state', () => {
    const node = CallNodeModel.create({
      state: ECallStatus.DISCONNECTING,
      context: {
        pendingDisconnect: true,
      },
    });

    expect(node.hasDisconnecting()).toBe(true);
    expect(node.pendingDisconnect).toBe(true);
    expect(node.number).toBeUndefined();
  });
});

describe('CallNode guards', () => {
  it('detects state by generic guard', () => {
    const value = {
      state: ECallStatus.CONNECTING,
      context: {
        number: '555',
        answer: false,
      },
    };

    expect(isCallNodeState(value, ECallStatus.CONNECTING)).toBe(true);
    expect(isCallNodeState(value, ECallStatus.IDLE)).toBe(false);
  });

  it('provides per-state runtime checks', () => {
    const idleValue = { state: ECallStatus.IDLE, context: {} };
    const inRoomValue = {
      state: ECallStatus.IN_ROOM,
      context: {
        number: '200',
        answer: false,
        room: 'room-2',
        participantName: 'bob',
        token: 'token-2',
        conferenceForToken: 'room-2',
      },
    };
    const disconnectingValue = {
      state: ECallStatus.DISCONNECTING,
      context: { pendingDisconnect: true as const },
    };

    expect(isIdleCallNode(idleValue)).toBe(true);
    expect(isConnectingCallNode(idleValue)).toBe(false);

    expect(isInRoomCallNode(inRoomValue)).toBe(true);
    expect(isIdleCallNode(inRoomValue)).toBe(false);

    expect(isDisconnectingCallNode(disconnectingValue)).toBe(true);
    expect(isInRoomCallNode(disconnectingValue)).toBe(false);
  });

  it('narrows types at compile time via guards', () => {
    type TGuardCandidate =
      | { state: ECallStatus.IDLE; context: object }
      | { state: ECallStatus.CONNECTING; context: { number: string; answer: boolean } }
      | {
          state: ECallStatus.IN_ROOM;
          context: {
            number: string;
            answer: boolean;
            room: string;
            participantName: string;
            token: string;
            conferenceForToken: string;
          };
        }
      | { state: ECallStatus.DISCONNECTING; context: { pendingDisconnect?: true } };

    const assertNarrowing = (candidate: TGuardCandidate) => {
      if (isCallNodeState(candidate, ECallStatus.CONNECTING)) {
        expectType<Extract<TGuardCandidate, { state: ECallStatus.CONNECTING }>>(candidate);
        expectType<string>(candidate.context.number);
        expectType<boolean>(candidate.context.answer);
      }

      if (isInRoomCallNode(candidate)) {
        expectType<Extract<TGuardCandidate, { state: ECallStatus.IN_ROOM }>>(candidate);
        expectType<string>(candidate.context.token);
        expectType<string>(candidate.context.conferenceForToken);
      }

      if (isIdleCallNode(candidate)) {
        expectType<Extract<TGuardCandidate, { state: ECallStatus.IDLE }>>(candidate);
        expectType<object>(candidate.context);
      }

      if (isDisconnectingCallNode(candidate)) {
        expectType<Extract<TGuardCandidate, { state: ECallStatus.DISCONNECTING }>>(candidate);
        expectType<true | undefined>(candidate.context.pendingDisconnect);
      }

      if (isConnectingCallNode(candidate)) {
        expectType<Extract<TGuardCandidate, { state: ECallStatus.CONNECTING }>>(candidate);
        expectType<string>(candidate.context.number);
      }
    };

    const sample: TGuardCandidate = {
      state: ECallStatus.CONNECTING,
      context: { number: '111', answer: false },
    };

    assertNarrowing(sample);
    expect(true).toBe(true);
  });
});
