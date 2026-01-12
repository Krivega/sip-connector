import { assign, setup } from 'xstate';

import { EConnectionStatus } from './types';

import type { TConnectionEvent } from './types';

interface IConnectionContext {
  lastError?: unknown;
}

export const connectionMachine = setup({
  types: {
    context: {} as IConnectionContext,
    events: {} as TConnectionEvent,
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
  id: 'connection',
  initial: EConnectionStatus.IDLE,
  context: {},
  states: {
    [EConnectionStatus.IDLE]: {
      on: {
        'CONNECTION.START': {
          target: EConnectionStatus.CONNECTING,
          actions: 'resetError',
        },
        'CONNECTION.RESET': EConnectionStatus.IDLE,
      },
    },
    [EConnectionStatus.CONNECTING]: {
      on: {
        'CONNECTION.INIT': EConnectionStatus.INITIALIZING,
        'CONNECTION.CONNECTED': EConnectionStatus.CONNECTED,
        'CONNECTION.DISCONNECTED': EConnectionStatus.DISCONNECTED,
        'CONNECTION.FAILED': {
          target: EConnectionStatus.FAILED,
          actions: 'rememberError',
        },
        'CONNECTION.RESET': {
          target: EConnectionStatus.IDLE,
          actions: 'resetError',
        },
      },
    },
    [EConnectionStatus.INITIALIZING]: {
      on: {
        'CONNECTION.CONNECTED': EConnectionStatus.CONNECTED,
        'CONNECTION.REGISTERED': EConnectionStatus.REGISTERED,
        'CONNECTION.DISCONNECTED': EConnectionStatus.DISCONNECTED,
        'CONNECTION.FAILED': {
          target: EConnectionStatus.FAILED,
          actions: 'rememberError',
        },
        'CONNECTION.RESET': {
          target: EConnectionStatus.IDLE,
          actions: 'resetError',
        },
      },
    },
    [EConnectionStatus.CONNECTED]: {
      on: {
        'CONNECTION.REGISTERED': EConnectionStatus.REGISTERED,
        'CONNECTION.UNREGISTERED': EConnectionStatus.CONNECTED,
        'CONNECTION.DISCONNECTED': EConnectionStatus.DISCONNECTED,
        'CONNECTION.FAILED': {
          target: EConnectionStatus.FAILED,
          actions: 'rememberError',
        },
        'CONNECTION.RESET': {
          target: EConnectionStatus.IDLE,
          actions: 'resetError',
        },
      },
    },
    [EConnectionStatus.REGISTERED]: {
      on: {
        'CONNECTION.UNREGISTERED': EConnectionStatus.CONNECTED,
        'CONNECTION.DISCONNECTED': EConnectionStatus.DISCONNECTED,
        'CONNECTION.FAILED': {
          target: EConnectionStatus.FAILED,
          actions: 'rememberError',
        },
        'CONNECTION.RESET': {
          target: EConnectionStatus.IDLE,
          actions: 'resetError',
        },
      },
    },
    [EConnectionStatus.DISCONNECTED]: {
      on: {
        'CONNECTION.START': {
          target: EConnectionStatus.CONNECTING,
          actions: 'resetError',
        },
        'CONNECTION.RESET': {
          target: EConnectionStatus.IDLE,
          actions: 'resetError',
        },
      },
    },
    [EConnectionStatus.FAILED]: {
      on: {
        'CONNECTION.START': {
          target: EConnectionStatus.CONNECTING,
          actions: 'resetError',
        },
        'CONNECTION.RESET': {
          target: EConnectionStatus.IDLE,
          actions: 'resetError',
        },
      },
    },
  },
});
