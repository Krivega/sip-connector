import { assign, setup } from 'xstate';

import { ECallEvent } from '@/CallManager';
import { BaseStateMachine } from '@/tools/BaseStateMachine';

import type { ActorRefFrom, SnapshotFrom } from 'xstate';
import type { TCallEvents } from '@/CallManager';

export enum EState {
  IDLE = 'presentation:idle',
  STARTING = 'presentation:starting',
  ACTIVE = 'presentation:active',
  STOPPING = 'presentation:stopping',
  FAILED = 'presentation:failed',
}

type TPresentationEvent =
  | { type: 'SCREEN.STARTING' }
  | { type: 'SCREEN.STARTED' }
  | { type: 'SCREEN.ENDING' }
  | { type: 'SCREEN.ENDED' }
  | { type: 'SCREEN.FAILED'; error?: unknown }
  | { type: 'CALL.ENDED' }
  | { type: 'CALL.FAILED'; error?: unknown };

interface IPresentationContext {
  lastError?: unknown;
}

const presentationMachine = setup({
  types: {
    context: {} as IPresentationContext,
    events: {} as TPresentationEvent,
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
  id: 'presentation',
  initial: EState.IDLE,
  context: {},
  states: {
    [EState.IDLE]: {
      on: {
        'SCREEN.STARTING': {
          target: EState.STARTING,
          actions: 'resetError',
        },
        'SCREEN.FAILED': {
          target: EState.FAILED,
          actions: 'rememberError',
        },
      },
    },
    [EState.STARTING]: {
      on: {
        'SCREEN.STARTED': EState.ACTIVE,
        'SCREEN.FAILED': {
          target: EState.FAILED,
          actions: 'rememberError',
        },
        'SCREEN.ENDED': {
          target: EState.IDLE,
          actions: 'resetError',
        },
        'CALL.ENDED': {
          target: EState.IDLE,
          actions: 'resetError',
        },
      },
    },
    [EState.ACTIVE]: {
      on: {
        'SCREEN.ENDING': EState.STOPPING,
        'SCREEN.ENDED': {
          target: EState.IDLE,
          actions: 'resetError',
        },
        'SCREEN.FAILED': {
          target: EState.FAILED,
          actions: 'rememberError',
        },
        'CALL.ENDED': {
          target: EState.IDLE,
          actions: 'resetError',
        },
        'CALL.FAILED': {
          target: EState.FAILED,
          actions: 'rememberError',
        },
      },
    },
    [EState.STOPPING]: {
      on: {
        'SCREEN.ENDED': {
          target: EState.IDLE,
          actions: 'resetError',
        },
        'SCREEN.FAILED': {
          target: EState.FAILED,
          actions: 'rememberError',
        },
        'CALL.ENDED': {
          target: EState.IDLE,
          actions: 'resetError',
        },
      },
    },
    [EState.FAILED]: {
      on: {
        'SCREEN.STARTING': {
          target: EState.STARTING,
          actions: 'resetError',
        },
        'SCREEN.ENDED': {
          target: EState.IDLE,
          actions: 'resetError',
        },
      },
    },
  },
});

export type TPresentationSnapshot = SnapshotFrom<typeof presentationMachine>;
export type TPresentationActor = ActorRefFrom<typeof presentationMachine>;

export class PresentationStateMachine extends BaseStateMachine<typeof presentationMachine, EState> {
  public constructor(callEvents: TCallEvents) {
    super(presentationMachine);

    this.subscribeCallEvents(callEvents);
  }

  private subscribeCallEvents(events: TCallEvents) {
    this.addSubscription(
      events.on(ECallEvent.START_PRESENTATION, () => {
        this.send({ type: 'SCREEN.STARTING' });
      }),
    );
    this.addSubscription(
      events.on(ECallEvent.STARTED_PRESENTATION, () => {
        this.send({ type: 'SCREEN.STARTED' });
      }),
    );
    this.addSubscription(
      events.on(ECallEvent.END_PRESENTATION, () => {
        this.send({ type: 'SCREEN.ENDING' });
      }),
    );
    this.addSubscription(
      events.on(ECallEvent.ENDED_PRESENTATION, () => {
        this.send({ type: 'SCREEN.ENDED' });
      }),
    );
    this.addSubscription(
      events.on(ECallEvent.FAILED_PRESENTATION, (error) => {
        this.send({ type: 'SCREEN.FAILED', error });
      }),
    );

    this.addSubscription(
      events.on(ECallEvent.ENDED, () => {
        this.send({ type: 'CALL.ENDED' });
      }),
    );
    this.addSubscription(
      events.on(ECallEvent.FAILED, (error) => {
        this.send({ type: 'CALL.FAILED', error });
      }),
    );
  }
}
