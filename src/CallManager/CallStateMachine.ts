import { assign, setup } from 'xstate';

import { BaseStateMachine } from '@/tools/BaseStateMachine';

import type { ActorRefFrom, SnapshotFrom } from 'xstate';
import type { TEvents } from './events';

export enum EState {
  IDLE = 'call:idle',
  CONNECTING = 'call:connecting',
  RINGING = 'call:ringing',
  ACCEPTED = 'call:accepted',
  IN_CALL = 'call:inCall',
  ENDED = 'call:ended',
  FAILED = 'call:failed',
}

type TCallEvent =
  | { type: 'CALL.CONNECTING' }
  | { type: 'CALL.RINGING' }
  | { type: 'CALL.ACCEPTED' }
  | { type: 'CALL.CONFIRMED' }
  | { type: 'CALL.ENDED' }
  | { type: 'CALL.FAILED'; error?: unknown };

interface ICallContext {
  lastError?: unknown;
}

const callMachine = setup({
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
  initial: EState.IDLE,
  context: {},
  states: {
    [EState.IDLE]: {
      on: {
        'CALL.CONNECTING': {
          target: EState.CONNECTING,
          actions: 'resetError',
        },
        'CALL.RINGING': {
          target: EState.RINGING,
          actions: 'resetError',
        },
        'CALL.ACCEPTED': EState.ACCEPTED,
        'CALL.CONFIRMED': EState.IN_CALL,
      },
    },
    [EState.CONNECTING]: {
      on: {
        'CALL.RINGING': EState.RINGING,
        'CALL.ACCEPTED': EState.ACCEPTED,
        'CALL.CONFIRMED': EState.IN_CALL,
        'CALL.ENDED': EState.ENDED,
        'CALL.FAILED': {
          target: EState.FAILED,
          actions: 'rememberError',
        },
        'CALL.CONNECTING': {
          target: EState.CONNECTING,
          actions: 'resetError',
        },
      },
    },
    [EState.RINGING]: {
      on: {
        'CALL.ACCEPTED': EState.ACCEPTED,
        'CALL.CONFIRMED': EState.IN_CALL,
        'CALL.ENDED': EState.ENDED,
        'CALL.FAILED': {
          target: EState.FAILED,
          actions: 'rememberError',
        },
        'CALL.CONNECTING': {
          target: EState.CONNECTING,
          actions: 'resetError',
        },
      },
    },
    [EState.ACCEPTED]: {
      on: {
        'CALL.CONFIRMED': EState.IN_CALL,
        'CALL.ENDED': EState.ENDED,
        'CALL.FAILED': {
          target: EState.FAILED,
          actions: 'rememberError',
        },
      },
    },
    [EState.IN_CALL]: {
      on: {
        'CALL.ENDED': EState.ENDED,
        'CALL.FAILED': {
          target: EState.FAILED,
          actions: 'rememberError',
        },
      },
    },
    [EState.ENDED]: {
      on: {
        'CALL.CONNECTING': {
          target: EState.CONNECTING,
          actions: 'resetError',
        },
        'CALL.RINGING': {
          target: EState.RINGING,
          actions: 'resetError',
        },
        'CALL.CONFIRMED': EState.IN_CALL,
        'CALL.ACCEPTED': EState.ACCEPTED,
      },
    },
    [EState.FAILED]: {
      on: {
        'CALL.CONNECTING': {
          target: EState.CONNECTING,
          actions: 'resetError',
        },
        'CALL.RINGING': {
          target: EState.RINGING,
          actions: 'resetError',
        },
        'CALL.ENDED': {
          target: EState.ENDED,
          actions: 'resetError',
        },
      },
    },
  },
});

export type TCallSnapshot = SnapshotFrom<typeof callMachine>;
export type TCallActor = ActorRefFrom<typeof callMachine>;

export class CallStateMachine extends BaseStateMachine<typeof callMachine, EState> {
  public constructor(events: TEvents) {
    super(callMachine);

    this.subscribeToEvents(events);
  }

  private subscribeToEvents(events: TEvents) {
    this.addSubscription(
      events.on('connecting', () => {
        this.send({ type: 'CALL.CONNECTING' });
      }),
    );
    this.addSubscription(
      events.on('progress', () => {
        this.send({ type: 'CALL.RINGING' });
      }),
    );
    this.addSubscription(
      events.on('accepted', () => {
        this.send({ type: 'CALL.ACCEPTED' });
      }),
    );
    this.addSubscription(
      events.on('confirmed', () => {
        this.send({ type: 'CALL.CONFIRMED' });
      }),
    );
    this.addSubscription(
      events.on('ended', () => {
        this.send({ type: 'CALL.ENDED' });
      }),
    );
    this.addSubscription(
      events.on('failed', (error) => {
        this.send({ type: 'CALL.FAILED', error });
      }),
    );
  }
}
