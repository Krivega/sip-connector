import { assign, setup } from 'xstate';

export enum EConnectionStatus {
  IDLE = 'connection:idle',
  CONNECTING = 'connection:connecting',
  INITIALIZING = 'connection:initializing',
  CONNECTED = 'connection:connected',
  REGISTERED = 'connection:registered',
  DISCONNECTED = 'connection:disconnected',
  FAILED = 'connection:failed',
}

export type TConnectionEvent =
  | { type: 'CONNECTION.START' }
  | { type: 'CONNECTION.INIT' }
  | { type: 'CONNECTION.CONNECTED' }
  | { type: 'CONNECTION.REGISTERED' }
  | { type: 'CONNECTION.UNREGISTERED' }
  | { type: 'CONNECTION.DISCONNECTED' }
  | { type: 'CONNECTION.FAILED'; error?: unknown }
  | { type: 'CONNECTION.RESET' };

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
