import { assign, setup } from 'xstate';

export enum ECallStatus {
  IDLE = 'call:idle',
  CONNECTING = 'call:connecting',
  RINGING = 'call:ringing',
  ACCEPTED = 'call:accepted',
  IN_CALL = 'call:inCall',
  ENDED = 'call:ended',
  FAILED = 'call:failed',
}

export type TCallEvent =
  | { type: 'CALL.CONNECTING' }
  | { type: 'CALL.RINGING' }
  | { type: 'CALL.ACCEPTED' }
  | { type: 'CALL.CONFIRMED' }
  | { type: 'CALL.ENDED' }
  | { type: 'CALL.FAILED'; error?: unknown };

interface ICallContext {
  lastError?: unknown;
}

export const callMachine = setup({
  types: {
    context: {} as ICallContext,
    events: {} as TCallEvent,
  },
  actions: {
    rememberError: assign(({ event }) => {
      return {
        lastError: 'error' in event ? event.error : undefined,
      };
    }),
    resetError: assign({ lastError: undefined }),
  },
}).createMachine({
  id: 'call',
  initial: ECallStatus.IDLE,
  context: {},
  states: {
    [ECallStatus.IDLE]: {
      on: {
        'CALL.CONNECTING': {
          target: ECallStatus.CONNECTING,
          actions: 'resetError',
        },
        'CALL.RINGING': {
          target: ECallStatus.RINGING,
          actions: 'resetError',
        },
        'CALL.ACCEPTED': ECallStatus.ACCEPTED,
        'CALL.CONFIRMED': ECallStatus.IN_CALL,
      },
    },
    [ECallStatus.CONNECTING]: {
      on: {
        'CALL.RINGING': ECallStatus.RINGING,
        'CALL.ACCEPTED': ECallStatus.ACCEPTED,
        'CALL.CONFIRMED': ECallStatus.IN_CALL,
        'CALL.ENDED': ECallStatus.ENDED,
        'CALL.FAILED': {
          target: ECallStatus.FAILED,
          actions: 'rememberError',
        },
        'CALL.CONNECTING': {
          target: ECallStatus.CONNECTING,
          actions: 'resetError',
        },
      },
    },
    [ECallStatus.RINGING]: {
      on: {
        'CALL.ACCEPTED': ECallStatus.ACCEPTED,
        'CALL.CONFIRMED': ECallStatus.IN_CALL,
        'CALL.ENDED': ECallStatus.ENDED,
        'CALL.FAILED': {
          target: ECallStatus.FAILED,
          actions: 'rememberError',
        },
        'CALL.CONNECTING': {
          target: ECallStatus.CONNECTING,
          actions: 'resetError',
        },
      },
    },
    [ECallStatus.ACCEPTED]: {
      on: {
        'CALL.CONFIRMED': ECallStatus.IN_CALL,
        'CALL.ENDED': ECallStatus.ENDED,
        'CALL.FAILED': {
          target: ECallStatus.FAILED,
          actions: 'rememberError',
        },
      },
    },
    [ECallStatus.IN_CALL]: {
      on: {
        'CALL.ENDED': ECallStatus.ENDED,
        'CALL.FAILED': {
          target: ECallStatus.FAILED,
          actions: 'rememberError',
        },
      },
    },
    [ECallStatus.ENDED]: {
      on: {
        'CALL.CONNECTING': {
          target: ECallStatus.CONNECTING,
          actions: 'resetError',
        },
        'CALL.RINGING': {
          target: ECallStatus.RINGING,
          actions: 'resetError',
        },
        'CALL.CONFIRMED': ECallStatus.IN_CALL,
        'CALL.ACCEPTED': ECallStatus.ACCEPTED,
      },
    },
    [ECallStatus.FAILED]: {
      on: {
        'CALL.CONNECTING': {
          target: ECallStatus.CONNECTING,
          actions: 'resetError',
        },
        'CALL.RINGING': {
          target: ECallStatus.RINGING,
          actions: 'resetError',
        },
        'CALL.ENDED': {
          target: ECallStatus.ENDED,
          actions: 'resetError',
        },
      },
    },
  },
});
