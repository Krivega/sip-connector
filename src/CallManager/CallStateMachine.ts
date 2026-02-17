import { assign, setup } from 'xstate';

import { BaseStateMachine } from '@/tools/BaseStateMachine';
import hasPeerToPeer from '@/tools/hasPeerToPeer';
import hasPurgatory from '@/tools/hasPurgatory';

import type { TApiManagerEvents } from '@/ApiManager';
import type { TEvents } from './events';

export enum EState {
  IDLE = 'call:idle',
  CONNECTING = 'call:connecting',
  PURGATORY = 'call:purgatory',
  P2P_ROOM = 'call:p2pRoom',
  DIRECT_P2P_ROOM = 'call:directP2pRoom',
  IN_ROOM = 'call:inRoom',
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type TIdleContext = {};
type TConnectingContext = {
  number: string;
  answer: boolean;
};

export type TPurgatoryContext = TConnectingContext & {
  room: string;
  participantName: string;
};

export type TP2PRoomContext = TConnectingContext & {
  room: string;
  participantName: string;
};

export type TDirectP2PRoomContext = TConnectingContext & {
  room: string;
  participantName: string;
  isDirectPeerToPeer: true;
};

export type TInRoomContext = TConnectingContext & {
  room: string;
  participantName: string;
  token: string; // jwt
  conference: string;
  participant: string;
};

type TContext =
  | TIdleContext
  | TConnectingContext
  | TPurgatoryContext
  | TP2PRoomContext
  | TDirectP2PRoomContext
  | TInRoomContext;

type TCallEvent =
  | { type: 'CALL.CONNECTING'; number: string; answer: boolean }
  | {
      type: 'CALL.ENTER_ROOM';
      room: string;
      participantName: string;
      token?: string;
      isDirectPeerToPeer?: boolean;
    }
  | { type: 'CALL.TOKEN_ISSUED'; token: string }
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
  return 'token' in context && isNonEmptyString(context.token);
};

const hasDirectPeerToPeer = ({ isDirectPeerToPeer }: { isDirectPeerToPeer?: boolean }): boolean => {
  return isDirectPeerToPeer === true;
};

const hasNoTokenRoom = (event: { room?: string; isDirectPeerToPeer?: boolean }): boolean => {
  return hasPurgatory(event.room) || hasPeerToPeer(event.room) || hasDirectPeerToPeer(event);
};

const hasPurgatoryContext = (context: TContext): context is TPurgatoryContext => {
  return (
    hasConnectingContext(context) &&
    hasRoomContext(context) &&
    !hasTokenContext(context) &&
    'room' in context &&
    hasPurgatory(context.room)
  );
};

const hasP2PRoomContext = (context: TContext): context is TP2PRoomContext => {
  return (
    hasConnectingContext(context) &&
    hasRoomContext(context) &&
    !hasTokenContext(context) &&
    'room' in context &&
    hasPeerToPeer(context.room)
  );
};

const hasDirectPeerToPeerContext = (context: TContext): boolean => {
  return 'isDirectPeerToPeer' in context && hasDirectPeerToPeer(context);
};

const hasDirectP2PRoomContext = (context: TContext): context is TDirectP2PRoomContext => {
  return (
    hasConnectingContext(context) &&
    hasRoomContext(context) &&
    !hasTokenContext(context) &&
    'room' in context &&
    hasDirectPeerToPeerContext(context)
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
    isDirectPeerToPeer: undefined,
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

      const nextContext: {
        room: string;
        participantName: string;
        token?: string;
        isDirectPeerToPeer?: boolean;
      } = {
        room: event.room,
        participantName: event.participantName,
      };

      if (event.token !== undefined) {
        nextContext.token = event.token;
      } else if (hasNoTokenRoom(event)) {
        nextContext.token = undefined;
      }

      if (event.isDirectPeerToPeer !== undefined) {
        nextContext.isDirectPeerToPeer = event.isDirectPeerToPeer;
      }

      return nextContext;
    }),
    setTokenInfo: assign(({ event, context }) => {
      if (event.type !== 'CALL.TOKEN_ISSUED') {
        return context;
      }

      return {
        token: event.token,
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
          target: EState.DIRECT_P2P_ROOM,
          guard: ({ context }) => {
            return hasDirectP2PRoomContext(context);
          },
        },
        {
          target: EState.P2P_ROOM,
          guard: ({ context }) => {
            return hasP2PRoomContext(context);
          },
        },
        {
          target: EState.PURGATORY,
          guard: ({ context }) => {
            return hasPurgatoryContext(context);
          },
        },
        {
          target: EState.CONNECTING,
          guard: ({ context }) => {
            return hasConnectingContext(context);
          },
        },
        {
          target: EState.IDLE,
        },
      ],
    },
    [EState.PURGATORY]: {
      on: {
        'CALL.ENTER_ROOM': {
          target: EVALUATE,
          actions: 'setRoomInfo',
        },
        'CALL.TOKEN_ISSUED': {
          target: EVALUATE,
          actions: 'setTokenInfo',
        },
        'CALL.RESET': {
          target: EVALUATE,
          actions: 'reset',
        },
      },
    },
    [EState.P2P_ROOM]: {
      on: {
        'CALL.ENTER_ROOM': {
          target: EVALUATE,
          actions: 'setRoomInfo',
        },
        'CALL.TOKEN_ISSUED': {
          target: EVALUATE,
          actions: 'setTokenInfo',
        },
        'CALL.RESET': {
          target: EVALUATE,
          actions: 'reset',
        },
      },
    },
    [EState.DIRECT_P2P_ROOM]: {
      on: {
        'CALL.ENTER_ROOM': {
          target: EVALUATE,
          actions: 'setRoomInfo',
        },
        'CALL.TOKEN_ISSUED': {
          target: EVALUATE,
          actions: 'setTokenInfo',
        },
        'CALL.RESET': {
          target: EVALUATE,
          actions: 'reset',
        },
      },
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

  public get isInPurgatory(): boolean {
    return this.state === EState.PURGATORY;
  }

  public get isP2PRoom(): boolean {
    return this.state === EState.P2P_ROOM;
  }

  public get isDirectP2PRoom(): boolean {
    return this.state === EState.DIRECT_P2P_ROOM;
  }

  public get isInRoom(): boolean {
    return this.state === EState.IN_ROOM;
  }

  /** Контекст в состоянии IN_ROOM; undefined в остальных состояниях. Использовать вместо каста context. */
  public get inRoomContext(): TInRoomContext | undefined {
    const { context } = this;

    return hasInRoomContext(context) ? context : undefined;
  }

  public get isActive(): boolean {
    return this.isInRoom || this.isInPurgatory || this.isP2PRoom || this.isDirectP2PRoom;
  }

  public get isPending(): boolean {
    return this.isConnecting;
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

  public get isCallInitiator(): boolean {
    return !this.isCallAnswerer;
  }

  public get isCallAnswerer(): boolean {
    const { context } = this;

    return 'answer' in context ? context.answer : false;
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
      apiManager.on('enter-room', ({ room, participantName, bearerToken, isDirectPeerToPeer }) => {
        this.send({
          type: 'CALL.ENTER_ROOM',
          room,
          participantName,
          token: bearerToken,
          isDirectPeerToPeer,
        });
      }),
    );
    this.addSubscription(
      apiManager.on('conference:participant-token-issued', ({ jwt: token }) => {
        this.send({ type: 'CALL.TOKEN_ISSUED', token });
      }),
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
      events.on('failed', () => {
        this.send({ type: 'CALL.RESET' });
      }),
    );
  }
}
