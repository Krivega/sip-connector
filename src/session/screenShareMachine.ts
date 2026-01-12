import { assign, setup } from 'xstate';

import { EScreenShareStatus } from './types';

import type { TScreenShareEvent, TCallEvent, TConnectionEvent } from './types';

type TScreenShareMachineEvent = TScreenShareEvent | TCallEvent | TConnectionEvent;

interface IScreenShareContext {
  lastError?: unknown;
}

export const screenShareMachine = setup({
  types: {
    context: {} as IScreenShareContext,
    events: {} as TScreenShareMachineEvent,
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
  id: 'screenShare',
  initial: EScreenShareStatus.IDLE,
  context: {},
  states: {
    [EScreenShareStatus.IDLE]: {
      on: {
        'SCREEN.STARTING': {
          target: EScreenShareStatus.STARTING,
          actions: 'resetError',
        },
        'SCREEN.FAILED': {
          target: EScreenShareStatus.FAILED,
          actions: 'rememberError',
        },
      },
    },
    [EScreenShareStatus.STARTING]: {
      on: {
        'SCREEN.STARTED': EScreenShareStatus.ACTIVE,
        'SCREEN.FAILED': {
          target: EScreenShareStatus.FAILED,
          actions: 'rememberError',
        },
        'SCREEN.ENDED': {
          target: EScreenShareStatus.IDLE,
          actions: 'resetError',
        },
        'CALL.ENDED': {
          target: EScreenShareStatus.IDLE,
          actions: 'resetError',
        },
        'CONNECTION.DISCONNECTED': {
          target: EScreenShareStatus.IDLE,
          actions: 'resetError',
        },
        'CONNECTION.FAILED': {
          target: EScreenShareStatus.IDLE,
          actions: 'rememberError',
        },
      },
    },
    [EScreenShareStatus.ACTIVE]: {
      on: {
        'SCREEN.ENDING': EScreenShareStatus.STOPPING,
        'SCREEN.ENDED': {
          target: EScreenShareStatus.IDLE,
          actions: 'resetError',
        },
        'SCREEN.FAILED': {
          target: EScreenShareStatus.FAILED,
          actions: 'rememberError',
        },
        'CALL.ENDED': {
          target: EScreenShareStatus.IDLE,
          actions: 'resetError',
        },
        'CALL.FAILED': {
          target: EScreenShareStatus.FAILED,
          actions: 'rememberError',
        },
        'CONNECTION.DISCONNECTED': {
          target: EScreenShareStatus.IDLE,
          actions: 'resetError',
        },
        'CONNECTION.FAILED': {
          target: EScreenShareStatus.FAILED,
          actions: 'rememberError',
        },
      },
    },
    [EScreenShareStatus.STOPPING]: {
      on: {
        'SCREEN.ENDED': {
          target: EScreenShareStatus.IDLE,
          actions: 'resetError',
        },
        'SCREEN.FAILED': {
          target: EScreenShareStatus.FAILED,
          actions: 'rememberError',
        },
        'CALL.ENDED': {
          target: EScreenShareStatus.IDLE,
          actions: 'resetError',
        },
        'CONNECTION.DISCONNECTED': {
          target: EScreenShareStatus.IDLE,
          actions: 'resetError',
        },
      },
    },
    [EScreenShareStatus.FAILED]: {
      on: {
        'SCREEN.STARTING': {
          target: EScreenShareStatus.STARTING,
          actions: 'resetError',
        },
        'SCREEN.ENDED': {
          target: EScreenShareStatus.IDLE,
          actions: 'resetError',
        },
        'CONNECTION.DISCONNECTED': {
          target: EScreenShareStatus.IDLE,
          actions: 'resetError',
        },
      },
    },
  },
});
