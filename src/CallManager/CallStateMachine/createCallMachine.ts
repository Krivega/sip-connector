import { assign } from 'xstate';

import { CALL_MACHINE_EVALUATE_STATE as EVALUATE, EState, initialContext } from './constants';
import { createCallMachineSetup } from './createCallMachineSetup';
import { STATE_DESCRIPTORS } from './state';

export const createCallMachine = () => {
  return createCallMachineSetup().createMachine({
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
