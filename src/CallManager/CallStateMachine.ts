import { assign, setup } from 'xstate';

import { BaseStateMachine } from '@/tools/BaseStateMachine';

import type { EndEvent } from '@krivega/jssip';
import type { TApiManagerEvents } from '@/ApiManager';
import type { TEvents } from './events';

export enum EState {
  IDLE = 'call:idle',
  CONNECTING = 'call:connecting',
  IN_ROOM = 'call:inRoom',
  FAILED = 'call:failed',
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type TIdleContext = {};
type TConnectingContext = {
  number: string;
  answer: boolean;
};
type TInRoomContext = TConnectingContext & {
  room: string;
  participantName: string;
  token: string; // jwt
  conference: string;
  participant: string;
};
type TFailedContext = {
  error: EndEvent;
};
type TContext = TIdleContext | TConnectingContext | TInRoomContext | TFailedContext;

type TCallEvent =
  | { type: 'CALL.CONNECTING'; number: string; answer: boolean }
  | { type: 'CALL.ENTER_ROOM'; room: string; participantName: string }
  | { type: 'CALL.TOKEN_ISSUED'; token: string; conference: string; participant: string }
  | { type: 'CALL.FAILED'; error: EndEvent }
  | { type: 'CALL.RESET' };

const EVALUATE = 'evaluate' as const;

const isNonEmptyString = (value?: string): value is string => {
  return typeof value === 'string' && value.length > 0;
};

const hasConnectingContext = (context: TContext): context is TConnectingContext => {
  return (
    'number' in context && isNonEmptyString(context.number) && typeof context.answer === 'boolean'
  );
};

const hasRoomContext = (context: TContext) => {
  return (
    'room' in context && isNonEmptyString(context.room) && isNonEmptyString(context.participantName)
  );
};

const hasTokenContext = (context: TContext) => {
  return (
    'token' in context &&
    isNonEmptyString(context.token) &&
    isNonEmptyString(context.conference) &&
    isNonEmptyString(context.participant)
  );
};

const hasInRoomContext = (context: TContext): context is TInRoomContext => {
  return hasConnectingContext(context) && hasRoomContext(context) && hasTokenContext(context);
};

const initialContext: TIdleContext = {};

const clearCallContext = (): Partial<TContext> => {
  return {
    number: undefined,
    answer: undefined,
    room: undefined,
    participantName: undefined,
    token: undefined,
    conference: undefined,
    participant: undefined,
  };
};

const callMachine = setup({
  types: {
    context: initialContext as TContext,
    events: {} as TCallEvent,
  },
  actions: {
    setConnecting: assign(({ event, context }) => {
      if (event.type !== 'CALL.CONNECTING') {
        return context;
      }

      return {
        ...clearCallContext(),
        number: event.number,
        answer: event.answer,
      };
    }),
    setRoomInfo: assign(({ event, context }) => {
      if (event.type !== 'CALL.ENTER_ROOM') {
        return context;
      }

      return {
        room: event.room,
        participantName: event.participantName,
      };
    }),
    setTokenInfo: assign(({ event, context }) => {
      if (event.type !== 'CALL.TOKEN_ISSUED') {
        return context;
      }

      return {
        token: event.token,
        conference: event.conference,
        participant: event.participant,
      };
    }),
    setError: assign(({ event, context }) => {
      if (event.type !== 'CALL.FAILED') {
        return context;
      }

      return {
        ...clearCallContext(),
        error: event.error instanceof Error ? event.error : new Error(JSON.stringify(event.error)),
      };
    }),
    reset: assign(clearCallContext()),
  },
}).createMachine({
  id: 'call',
  initial: EState.IDLE,
  context: {},
  states: {
    [EState.IDLE]: {
      on: {
        'CALL.CONNECTING': {
          target: EVALUATE,
          actions: 'setConnecting',
        },
      },
    },
    [EState.CONNECTING]: {
      on: {
        'CALL.ENTER_ROOM': {
          target: EVALUATE,
          actions: 'setRoomInfo',
        },
        'CALL.TOKEN_ISSUED': {
          target: EVALUATE,
          actions: 'setTokenInfo',
        },
        'CALL.FAILED': {
          target: EVALUATE,
          actions: 'setError',
        },
        'CALL.RESET': {
          target: EVALUATE,
          actions: 'reset',
        },
      },
    },
    [EState.IN_ROOM]: {
      on: {
        'CALL.ENTER_ROOM': {
          target: EVALUATE,
          actions: 'setRoomInfo',
        },
        'CALL.TOKEN_ISSUED': {
          target: EVALUATE,
          actions: 'setTokenInfo',
        },
        'CALL.FAILED': {
          target: EVALUATE,
          actions: 'setError',
        },
        'CALL.RESET': {
          target: EVALUATE,
          actions: 'reset',
        },
      },
    },
    [EState.FAILED]: {
      on: {
        'CALL.CONNECTING': {
          target: EVALUATE,
          actions: 'setConnecting',
        },
        'CALL.RESET': {
          target: EVALUATE,
          actions: 'reset',
        },
      },
    },
    [EVALUATE]: {
      always: [
        {
          target: EState.IN_ROOM,
          guard: ({ context }) => {
            return hasInRoomContext(context);
          },
        },
        {
          target: EState.CONNECTING,
          guard: ({ context }) => {
            return hasConnectingContext(context);
          },
        },
        {
          target: EState.FAILED,
          guard: ({ context }) => {
            return 'error' in context;
          },
        },
        {
          target: EState.IDLE,
        },
      ],
    },
  },
});

export type TCallSnapshot = { value: EState; context: TContext };

export class CallStateMachine extends BaseStateMachine<typeof callMachine, EState, TContext> {
  public constructor(events: TEvents) {
    super(callMachine);

    this.subscribeToEvents(events);
  }

  public get isIdle(): boolean {
    return this.state === EState.IDLE;
  }

  public get isConnecting(): boolean {
    return this.state === EState.CONNECTING;
  }

  public get isInRoom(): boolean {
    return this.state === EState.IN_ROOM;
  }

  public get isFailed(): boolean {
    return this.state === EState.FAILED;
  }

  public get isActive(): boolean {
    return this.isInRoom;
  }

  public get isPending(): boolean {
    return this.isConnecting;
  }

  public get error() {
    const { context } = this;

    if ('error' in context) {
      return context.error;
    }

    return undefined;
  }

  public get number() {
    const { context } = this;

    if ('number' in context) {
      return context.number;
    }

    return undefined;
  }

  public get token() {
    const { context } = this;

    if ('token' in context) {
      return context.token;
    }

    return undefined;
  }

  public reset(): void {
    this.send({ type: 'CALL.RESET' });
  }

  public send(event: TCallEvent): void {
    const snapshot = this.actor.getSnapshot();

    if (!snapshot.can(event)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[CallStateMachine] Invalid transition: ${event.type} from ${this.state}. Event cannot be processed in current state.`,
      );

      return;
    }

    super.send(event);
  }

  public subscribeToApiEvents(apiManager: TApiManagerEvents): void {
    this.addSubscription(
      apiManager.on('enter-room', ({ room, participantName }) => {
        this.send({ type: 'CALL.ENTER_ROOM', room, participantName });
      }),
    );
    this.addSubscription(
      apiManager.on(
        'conference:participant-token-issued',
        ({ jwt: token, conference, participant }) => {
          this.send({ type: 'CALL.TOKEN_ISSUED', token, conference, participant });
        },
      ),
    );
  }

  private subscribeToEvents(events: TEvents) {
    this.addSubscription(
      events.on('start-call', ({ number, answer }) => {
        this.send({ type: 'CALL.CONNECTING', number, answer });
      }),
    );

    this.addSubscription(
      events.on('ended', () => {
        this.send({ type: 'CALL.RESET' });
      }),
    );
    this.addSubscription(
      events.on('failed', (event) => {
        this.send({ type: 'CALL.FAILED', error: event });
      }),
    );
  }
}
