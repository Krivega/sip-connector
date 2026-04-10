import { assign, setup } from 'xstate';

import hasPeerToPeer from '@/tools/hasPeerToPeer';
import hasPurgatory from '@/tools/hasPurgatory';
import { isValidBoolean, isValidString } from '@/utils/validators';
import { STATE_DESCRIPTORS, hasDirectPeerToPeer } from './state';
import { EState } from './types';

import type { TBaseContext } from './types';

type TContext = {
  raw: TBaseContext;
  state: TBaseContext;
};

type TCallEvent =
  | {
      type: 'CALL.CONNECTING';
      number: string;
      answer: boolean;
      extraHeaders?: string[];
    }
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
  | { type: 'CALL.PRESENTATION_CALL' }
  | { type: 'CALL.START_DISCONNECT' }
  | { type: 'CALL.RESET' };

const EVALUATE = 'evaluate' as const;

const hasNoTokenRoom = (event: { room?: string; isDirectPeerToPeer?: boolean }): boolean => {
  return hasPurgatory(event.room) || hasPeerToPeer(event.room) || hasDirectPeerToPeer(event);
};

const initialContext: TContext = {
  raw: {},
  state: {},
};

const clearRawContext = (): TBaseContext => {
  return {};
};

export const createCallMachine = () => {
  return setup({
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
            extraHeaders: event.extraHeaders,
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
      setConfirmed: assign(({ event, context }) => {
        if (event.type !== 'CALL.PRESENTATION_CALL') {
          return context;
        }

        return {
          raw: {
            ...context.raw,
            isConfirmed: true as const,
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
    },
  }).createMachine({
    id: 'call',
    initial: EState.IDLE,
    context: initialContext,
    states: {
      [EState.IDLE]: {
        entry: assign(() => {
          return { state: STATE_DESCRIPTORS[EState.IDLE].buildContext() };
        }),
        on: {
          'CALL.CONNECTING': {
            target: EVALUATE,
            actions: 'setConnecting',
          },
        },
      },
      [EState.CONNECTING]: {
        entry: assign(({ context }) => {
          return { state: STATE_DESCRIPTORS[EState.CONNECTING].buildContext(context.raw) };
        }),
        on: {
          'CALL.PRESENTATION_CALL': {
            target: EVALUATE,
            actions: 'setConfirmed',
          },
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
        entry: assign(({ context }) => {
          return { state: STATE_DESCRIPTORS[EState.ROOM_PENDING_AUTH].buildContext(context.raw) };
        }),
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
        entry: assign((params) => {
          return { state: STATE_DESCRIPTORS[EState.IN_ROOM].buildContext(params.context.raw) };
        }),
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
              return STATE_DESCRIPTORS[EState.DISCONNECTING].guard(context.raw);
            },
          },
          {
            target: EState.PRESENTATION_CALL,
            guard: ({ context }) => {
              return STATE_DESCRIPTORS[EState.PRESENTATION_CALL].guard(context.raw);
            },
          },
          {
            target: EState.IN_ROOM,
            guard: ({ context }) => {
              return STATE_DESCRIPTORS[EState.IN_ROOM].guard(context.raw);
            },
          },
          {
            target: EState.DIRECT_P2P_ROOM,
            guard: ({ context }) => {
              return STATE_DESCRIPTORS[EState.DIRECT_P2P_ROOM].guard(context.raw);
            },
          },
          {
            target: EState.P2P_ROOM,
            guard: ({ context }) => {
              return STATE_DESCRIPTORS[EState.P2P_ROOM].guard(context.raw);
            },
          },
          {
            target: EState.PURGATORY,
            guard: ({ context }) => {
              return STATE_DESCRIPTORS[EState.PURGATORY].guard(context.raw);
            },
          },
          {
            target: EState.ROOM_PENDING_AUTH,
            guard: ({ context }) => {
              return STATE_DESCRIPTORS[EState.ROOM_PENDING_AUTH].guard(context.raw);
            },
          },
          {
            target: EState.CONNECTING,
            guard: ({ context }) => {
              return STATE_DESCRIPTORS[EState.CONNECTING].guard(context.raw);
            },
          },
          {
            target: EState.IDLE,
          },
        ],
      },
      [EState.PURGATORY]: {
        entry: assign(({ context }) => {
          return { state: STATE_DESCRIPTORS[EState.PURGATORY].buildContext(context.raw) };
        }),
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
        entry: assign(({ context }) => {
          return { state: STATE_DESCRIPTORS[EState.P2P_ROOM].buildContext(context.raw) };
        }),
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
      [EState.PRESENTATION_CALL]: {
        entry: assign(({ context }) => {
          return { state: STATE_DESCRIPTORS[EState.PRESENTATION_CALL].buildContext(context.raw) };
        }),
        on: {
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
        entry: assign(({ context }) => {
          return { state: STATE_DESCRIPTORS[EState.DIRECT_P2P_ROOM].buildContext(context.raw) };
        }),
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
        entry: assign(() => {
          return { state: STATE_DESCRIPTORS[EState.DISCONNECTING].buildContext() };
        }),
        on: {
          'CALL.RESET': {
            target: EVALUATE,
            actions: 'reset',
          },
        },
      },
    },
  });
};
