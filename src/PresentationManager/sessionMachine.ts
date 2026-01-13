import { assign, setup } from 'xstate';

export enum EScreenShareStatus {
  IDLE = 'screenShare:idle',
  STARTING = 'screenShare:starting',
  ACTIVE = 'screenShare:active',
  STOPPING = 'screenShare:stopping',
  FAILED = 'screenShare:failed',
}

export type TScreenShareEvent =
  | { type: 'SCREEN.STARTING' }
  | { type: 'SCREEN.STARTED' }
  | { type: 'SCREEN.ENDING' }
  | { type: 'SCREEN.ENDED' }
  | { type: 'SCREEN.FAILED'; error?: unknown }
  | { type: 'CALL.ENDED' }
  | { type: 'CALL.FAILED'; error?: unknown }
  | { type: 'CONNECTION.DISCONNECTED' }
  | { type: 'CONNECTION.FAILED'; error?: unknown };

interface IScreenShareContext {
  lastError?: unknown;
}

export const screenShareMachine = setup({
  types: {
    context: {} as IScreenShareContext,
    events: {} as TScreenShareEvent,
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
