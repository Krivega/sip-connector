import { assign, setup } from 'xstate';

import { BaseStateMachine } from '@/tools/BaseStateMachine';
import hasPeerToPeer from '@/tools/hasPeerToPeer';
import hasPurgatory from '@/tools/hasPurgatory';
import { isValidBoolean, isValidString } from '@/utils/validators';

import type { TApiManagerEvents } from '@/ApiManager';
import type { TEvents } from './events';

export enum EState {
  IDLE = 'call:idle',
  CONNECTING = 'call:connecting',
  ROOM_PENDING_AUTH = 'call:roomPendingAuth',
  PURGATORY = 'call:purgatory',
  P2P_ROOM = 'call:p2pRoom',
  DIRECT_P2P_ROOM = 'call:directP2pRoom',
  IN_ROOM = 'call:inRoom',
  DISCONNECTING = 'call:disconnecting',
}

export type TIdleContext = { pendingDisconnect?: true };
export type TConnectingContext = {
  number: string;
  answer: boolean;
};

type TRoomContext = {
  room: string;
  participantName: string;
};

export type TPurgatoryContext = TConnectingContext & TRoomContext;

export type TP2PRoomContext = TConnectingContext & TRoomContext;

export type TRoomPendingAuthContext = TConnectingContext & TRoomContext;

export type TDirectP2PRoomContext = TConnectingContext &
  TRoomContext & { isDirectPeerToPeer: true };

export type TInRoomContext = TConnectingContext &
  TRoomContext & {
    token: string; // jwt
    conferenceForToken: string;
  };

type TBaseContext =
  | TIdleContext
  | TConnectingContext
  | TRoomPendingAuthContext
  | TPurgatoryContext
  | TP2PRoomContext
  | TDirectP2PRoomContext
  | TInRoomContext;

type TContext = {
  raw: TBaseContext;
  state: TBaseContext;
};

type TSnapshotContext<TState extends TBaseContext> = {
  raw: TBaseContext;
  state: TState;
};

type TCallEvent =
  | { type: 'CALL.CONNECTING'; number: string; answer: boolean }
  | {
      type: 'CALL.ENTER_ROOM';
      room: string;
      participantName: string;
      token?: string;
      isDirectPeerToPeer?: boolean;
    }
  | {
      type: 'CALL.TOKEN_ISSUED';
      token: string;
      conferenceForToken: string;
      participantName: string;
    }
  | { type: 'CALL.START_DISCONNECT' }
  | { type: 'CALL.RESET' };

const EVALUATE = 'evaluate' as const;

const hasConnectingContext = (context: TBaseContext): context is TConnectingContext => {
  return 'number' in context && isValidString(context.number) && isValidBoolean(context.answer);
};

const hasRoomContext = (context: TBaseContext) => {
  return 'room' in context && isValidString(context.room) && isValidString(context.participantName);
};

const hasTokenContext = (context: TBaseContext) => {
  return 'token' in context && isValidString(context.token);
};

const hasConferenceTokenContext = (context: TBaseContext) => {
  return (
    hasTokenContext(context) &&
    'conferenceForToken' in context &&
    isValidString(context.conferenceForToken)
  );
};

const hasMatchingConferenceToken = (context: TBaseContext) => {
  if (!hasConferenceTokenContext(context) || !('room' in context) || !isValidString(context.room)) {
    return false;
  }

  const { conferenceForToken } = context as { conferenceForToken: string };

  return conferenceForToken === context.room;
};

const hasDirectPeerToPeer = ({ isDirectPeerToPeer }: { isDirectPeerToPeer?: boolean }): boolean => {
  return isDirectPeerToPeer === true;
};

const hasNoTokenRoom = (event: { room?: string; isDirectPeerToPeer?: boolean }): boolean => {
  return hasPurgatory(event.room) || hasPeerToPeer(event.room) || hasDirectPeerToPeer(event);
};

const hasDirectPeerToPeerContext = (context: TBaseContext): boolean => {
  return 'isDirectPeerToPeer' in context && hasDirectPeerToPeer(context);
};

/** Поля контекста для комнаты purgatory (токен из TOKEN_ISSUED может уже лежать в context — это не переводит в IN_ROOM). */
const hasPurgatoryRoomSnapshot = (context: TBaseContext): context is TPurgatoryContext => {
  return (
    hasConnectingContext(context) &&
    hasRoomContext(context) &&
    'room' in context &&
    hasPurgatory(context.room)
  );
};

const hasP2PRoomSnapshot = (context: TBaseContext): context is TP2PRoomContext => {
  return (
    hasConnectingContext(context) &&
    hasRoomContext(context) &&
    'room' in context &&
    hasPeerToPeer(context.room) &&
    !hasDirectPeerToPeerContext(context)
  );
};

const hasDirectP2PRoomSnapshot = (context: TBaseContext): context is TDirectP2PRoomContext => {
  return (
    hasConnectingContext(context) &&
    hasRoomContext(context) &&
    'room' in context &&
    hasDirectPeerToPeerContext(context)
  );
};

const hasRoomPendingAuthContext = (context: TBaseContext): context is TRoomPendingAuthContext => {
  return (
    hasConnectingContext(context) &&
    hasRoomContext(context) &&
    'room' in context &&
    !hasPurgatory(context.room) &&
    !hasPeerToPeer(context.room) &&
    !hasDirectPeerToPeerContext(context) &&
    !hasMatchingConferenceToken(context)
  );
};

/** IN_ROOM только если `conferenceForToken === room` (в т.ч. после enter-room с bearer, где conference задаётся как room). */
const hasInRoomContext = (context: TBaseContext): context is TInRoomContext => {
  return (
    hasConnectingContext(context) &&
    hasRoomContext(context) &&
    hasConferenceTokenContext(context) &&
    hasMatchingConferenceToken(context)
  );
};

const shouldRemainInPurgatoryState = (context: TBaseContext): boolean => {
  return hasPurgatoryRoomSnapshot(context) && !hasInRoomContext(context);
};

const shouldRemainInP2PRoomState = (context: TBaseContext): boolean => {
  return hasP2PRoomSnapshot(context) && !hasInRoomContext(context);
};

const shouldRemainInDirectP2PRoomState = (context: TBaseContext): boolean => {
  return hasDirectP2PRoomSnapshot(context) && !hasInRoomContext(context);
};

type TRoomState = {
  number: string;
  answer: boolean;
  room: string;
  participantName: string;
};

const buildRoomStateContext = (raw: TBaseContext): TRoomState => {
  const roomContext = raw as TRoomState;

  return {
    number: roomContext.number,
    answer: roomContext.answer,
    room: roomContext.room,
    participantName: roomContext.participantName,
  };
};

export const buildStateContext = (state: EState, raw: TBaseContext): TBaseContext => {
  switch (state) {
    case EState.IDLE:
    case EState.DISCONNECTING: {
      return {};
    }
    case EState.CONNECTING: {
      const connectingContext = raw as TConnectingContext;

      return {
        number: connectingContext.number,
        answer: connectingContext.answer,
      };
    }
    case EState.ROOM_PENDING_AUTH:
    case EState.PURGATORY:
    case EState.P2P_ROOM: {
      return buildRoomStateContext(raw);
    }
    case EState.DIRECT_P2P_ROOM: {
      return {
        ...buildRoomStateContext(raw),
        isDirectPeerToPeer: true,
      };
    }
    case EState.IN_ROOM: {
      const inRoomContext = raw as TInRoomContext;

      return {
        ...buildRoomStateContext(raw),
        token: inRoomContext.token,
        conferenceForToken: inRoomContext.conferenceForToken,
      };
    }
    default: {
      return {};
    }
  }
};

const initialContext: TContext = {
  raw: {},
  state: {},
};

const clearRawContext = (): TBaseContext => {
  return {};
};

const callMachine = setup({
  types: {
    context: initialContext,
    events: {} as TCallEvent,
  },
  actions: {
    setConnecting: assign(({ event, context }) => {
      if (event.type !== 'CALL.CONNECTING') {
        return context;
      }

      return {
        raw: {
          ...clearRawContext(),
          number: event.number,
          answer: event.answer,
        },
      };
    }),
    setRoomInfo: assign(({ event, context }) => {
      if (event.type !== 'CALL.ENTER_ROOM') {
        return context;
      }

      const nextRaw: {
        room: string;
        participantName: string;
        token?: string;
        conferenceForToken?: string;
        isDirectPeerToPeer?: boolean;
      } = {
        room: event.room,
        participantName: event.participantName,
      };

      if (isValidString(event.token)) {
        nextRaw.token = event.token;
        nextRaw.conferenceForToken = event.room;
      } else if (hasNoTokenRoom(event)) {
        nextRaw.token = undefined;
        nextRaw.conferenceForToken = undefined;
      }

      if (isValidBoolean(event.isDirectPeerToPeer)) {
        nextRaw.isDirectPeerToPeer = event.isDirectPeerToPeer;
      }

      return {
        raw: {
          ...context.raw,
          ...nextRaw,
        },
      };
    }),
    setTokenInfo: assign(({ event, context }) => {
      if (event.type !== 'CALL.TOKEN_ISSUED') {
        return context;
      }

      return {
        raw: {
          ...context.raw,
          token: event.token,
          conferenceForToken: event.conferenceForToken,
          participantName: event.participantName,
        },
      };
    }),
    reset: assign(() => {
      return { raw: clearRawContext() };
    }),
    prepareDisconnect: assign(() => {
      return {
        raw: {
          ...clearRawContext(),
          pendingDisconnect: true as const,
        },
      };
    }),
    syncIdleStateContext: assign(({ context }) => {
      return { state: buildStateContext(EState.IDLE, context.raw) };
    }),
    syncConnectingStateContext: assign(({ context }) => {
      return { state: buildStateContext(EState.CONNECTING, context.raw) };
    }),
    syncRoomPendingAuthStateContext: assign(({ context }) => {
      return { state: buildStateContext(EState.ROOM_PENDING_AUTH, context.raw) };
    }),
    syncPurgatoryStateContext: assign(({ context }) => {
      return { state: buildStateContext(EState.PURGATORY, context.raw) };
    }),
    syncP2PRoomStateContext: assign(({ context }) => {
      return { state: buildStateContext(EState.P2P_ROOM, context.raw) };
    }),
    syncDirectP2PRoomStateContext: assign(({ context }) => {
      return { state: buildStateContext(EState.DIRECT_P2P_ROOM, context.raw) };
    }),
    syncInRoomStateContext: assign(({ context }) => {
      return { state: buildStateContext(EState.IN_ROOM, context.raw) };
    }),
    syncDisconnectingStateContext: assign(({ context }) => {
      return { state: buildStateContext(EState.DISCONNECTING, context.raw) };
    }),
  },
}).createMachine({
  id: 'call',
  initial: EState.IDLE,
  context: initialContext,
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
        'CALL.START_DISCONNECT': {
          target: EVALUATE,
          actions: 'prepareDisconnect',
        },
        'CALL.RESET': {
          target: EVALUATE,
          actions: 'reset',
        },
      },
    },
    [EState.ROOM_PENDING_AUTH]: {
      on: {
        'CALL.ENTER_ROOM': {
          target: EVALUATE,
          actions: 'setRoomInfo',
        },
        'CALL.TOKEN_ISSUED': {
          target: EVALUATE,
          actions: 'setTokenInfo',
        },
        'CALL.START_DISCONNECT': {
          target: EVALUATE,
          actions: 'prepareDisconnect',
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
        'CALL.START_DISCONNECT': {
          target: EVALUATE,
          actions: 'prepareDisconnect',
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
          target: EState.DISCONNECTING,
          guard: ({ context }) => {
            return (context.raw as TIdleContext).pendingDisconnect === true;
          },
          actions: ['reset', 'syncDisconnectingStateContext'],
        },
        {
          target: EState.IN_ROOM,
          guard: ({ context }) => {
            return hasInRoomContext(context.raw);
          },
          actions: 'syncInRoomStateContext',
        },
        {
          target: EState.DIRECT_P2P_ROOM,
          guard: ({ context }) => {
            return shouldRemainInDirectP2PRoomState(context.raw);
          },
          actions: 'syncDirectP2PRoomStateContext',
        },
        {
          target: EState.P2P_ROOM,
          guard: ({ context }) => {
            return shouldRemainInP2PRoomState(context.raw);
          },
          actions: 'syncP2PRoomStateContext',
        },
        {
          target: EState.PURGATORY,
          guard: ({ context }) => {
            return shouldRemainInPurgatoryState(context.raw);
          },
          actions: 'syncPurgatoryStateContext',
        },
        {
          target: EState.ROOM_PENDING_AUTH,
          guard: ({ context }) => {
            return hasRoomPendingAuthContext(context.raw);
          },
          actions: 'syncRoomPendingAuthStateContext',
        },
        {
          target: EState.CONNECTING,
          guard: ({ context }) => {
            return hasConnectingContext(context.raw);
          },
          actions: 'syncConnectingStateContext',
        },
        {
          target: EState.IDLE,
          actions: 'syncIdleStateContext',
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
        'CALL.START_DISCONNECT': {
          target: EVALUATE,
          actions: 'prepareDisconnect',
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
        'CALL.START_DISCONNECT': {
          target: EVALUATE,
          actions: 'prepareDisconnect',
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
        'CALL.START_DISCONNECT': {
          target: EVALUATE,
          actions: 'prepareDisconnect',
        },
        'CALL.RESET': {
          target: EVALUATE,
          actions: 'reset',
        },
      },
    },
    [EState.DISCONNECTING]: {
      on: {
        'CALL.RESET': {
          target: EVALUATE,
          actions: 'reset',
        },
      },
    },
  },
});

export type TSnapshot =
  | { value: EState.IDLE; context: TSnapshotContext<TIdleContext> }
  | { value: EState.CONNECTING; context: TSnapshotContext<TConnectingContext> }
  | { value: EState.ROOM_PENDING_AUTH; context: TSnapshotContext<TRoomPendingAuthContext> }
  | { value: EState.PURGATORY; context: TSnapshotContext<TPurgatoryContext> }
  | { value: EState.P2P_ROOM; context: TSnapshotContext<TP2PRoomContext> }
  | { value: EState.DIRECT_P2P_ROOM; context: TSnapshotContext<TDirectP2PRoomContext> }
  | { value: EState.IN_ROOM; context: TSnapshotContext<TInRoomContext> }
  | { value: EState.DISCONNECTING; context: TSnapshotContext<TIdleContext> };

export class CallStateMachine extends BaseStateMachine<
  typeof callMachine,
  EState,
  TContext,
  TSnapshot
> {
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

  public get isRoomPendingAuth(): boolean {
    return this.state === EState.ROOM_PENDING_AUTH;
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

  public get isDisconnecting(): boolean {
    return this.state === EState.DISCONNECTING;
  }

  /** Только в IDLE. См. `context` у актора для сырого значения. */
  public get idleContext(): TIdleContext | undefined {
    if (this.state !== EState.IDLE) {
      return undefined;
    }

    return this.context.state as TIdleContext;
  }

  /** Только в CONNECTING: номер и ответ; без полей комнаты и токена в типе. */
  public get connectingContext(): TConnectingContext | undefined {
    if (this.state !== EState.CONNECTING) {
      return undefined;
    }

    return this.context.state as TConnectingContext;
  }

  /**
   * Только в ROOM_PENDING_AUTH и при выполнении условий ожидания авторизации для обычной комнаты.
   * В сыром `context` могут быть лишние поля (например JWT до выравнивания с `room`).
   */
  public get roomPendingAuthContext(): TRoomPendingAuthContext | undefined {
    if (this.state !== EState.ROOM_PENDING_AUTH) {
      return undefined;
    }

    return this.context.state as TRoomPendingAuthContext;
  }

  /** Только в PURGATORY. */
  public get purgatoryContext(): TPurgatoryContext | undefined {
    if (this.state !== EState.PURGATORY) {
      return undefined;
    }

    return this.context.state as TPurgatoryContext;
  }

  /** Только в P2P_ROOM. */
  public get p2pRoomContext(): TP2PRoomContext | undefined {
    if (this.state !== EState.P2P_ROOM) {
      return undefined;
    }

    return this.context.state as TP2PRoomContext;
  }

  /** Только в DIRECT_P2P_ROOM. */
  public get directP2pRoomContext(): TDirectP2PRoomContext | undefined {
    if (this.state !== EState.DIRECT_P2P_ROOM) {
      return undefined;
    }

    return this.context.state as TDirectP2PRoomContext;
  }

  /**
   * Валидный для использования контекст звонка в комнате: только в IN_ROOM и только если
   * `conferenceForToken` согласован с `room` (для обычных комнат). Сырой `context` может
   * содержать устаревший JWT или несовпадающий `conferenceForToken` — полагаться на него напрямую нельзя.
   */
  public get inRoomContext(): TInRoomContext | undefined {
    if (this.state !== EState.IN_ROOM) {
      return undefined;
    }

    return this.context.state as TInRoomContext;
  }

  /** Только в DISCONNECTING (контекст сброшен, опционально `pendingDisconnect`). */
  public get disconnectingContext(): TIdleContext | undefined {
    if (this.state !== EState.DISCONNECTING) {
      return undefined;
    }

    return this.context.state as TIdleContext;
  }

  public get isActive(): boolean {
    return (
      this.isInRoom ||
      this.isRoomPendingAuth ||
      this.isInPurgatory ||
      this.isP2PRoom ||
      this.isDirectP2PRoom
    );
  }

  public get number() {
    const { raw } = this.context;

    if ('number' in raw) {
      return raw.number;
    }

    return undefined;
  }

  public get token() {
    return this.inRoomContext?.token;
  }

  public get isCallInitiator(): boolean {
    return !this.isCallAnswerer;
  }

  public get isCallAnswerer(): boolean {
    return this.connectingContext?.answer ?? false;
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
          room,
          participantName,
          isDirectPeerToPeer,
          type: 'CALL.ENTER_ROOM',
          token: bearerToken,
        });
      }),
    );
    this.addSubscription(
      apiManager.on(
        'conference:participant-token-issued',
        ({ jwt: token, conference, participant }) => {
          this.send({
            token,
            type: 'CALL.TOKEN_ISSUED',
            conferenceForToken: conference,
            participantName: participant,
          });
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
      events.on('end-call', () => {
        this.send({ type: 'CALL.START_DISCONNECT' });
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
