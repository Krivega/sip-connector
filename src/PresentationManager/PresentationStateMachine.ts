import { assign, setup } from 'xstate';

import { ECallEvent } from '@/CallManager';
import logger from '@/logger';
import { BaseStateMachine } from '@/tools/BaseStateMachine';

import type { TCallEvents } from '@/CallManager';

export enum EState {
  IDLE = 'presentation:idle',
  STARTING = 'presentation:starting',
  ACTIVE = 'presentation:active',
  STOPPING = 'presentation:stopping',
  FAILED = 'presentation:failed',
}

enum EAction {
  LOG_TRANSITION = 'logTransition',
  LOG_STATE_CHANGE = 'logStateChange',
  SET_ERROR = 'setError',
  CLEAR_ERROR = 'clearError',
}

type TPresentationEvent =
  | { type: 'SCREEN.STARTING' }
  | { type: 'SCREEN.STARTED' }
  | { type: 'SCREEN.ENDING' }
  | { type: 'SCREEN.ENDED' }
  | { type: 'SCREEN.FAILED'; error?: unknown }
  | { type: 'CALL.ENDED' }
  | { type: 'CALL.FAILED'; error?: unknown }
  | { type: 'PRESENTATION.RESET' };

type TContext = {
  lastError?: Error;
};

const presentationMachine = setup({
  types: {
    context: {} as TContext,
    events: {} as TPresentationEvent,
  },
  actions: {
    [EAction.LOG_TRANSITION]: (_, params: { from: string; to: string; event: string }) => {
      logger(`State transition: ${params.from} -> ${params.to} (${params.event})`);
    },
    [EAction.LOG_STATE_CHANGE]: (_, params: { state: string }) => {
      logger('PresentationStateMachine state changed', params.state);
    },
    [EAction.SET_ERROR]: assign(({ event }) => {
      if ('error' in event && event.error !== undefined) {
        return {
          lastError:
            event.error instanceof Error ? event.error : new Error(JSON.stringify(event.error)),
        };
      }

      return { lastError: undefined };
    }),
    [EAction.CLEAR_ERROR]: assign({ lastError: undefined }),
  },
}).createMachine({
  id: 'presentation',
  initial: EState.IDLE,
  context: {},
  states: {
    [EState.IDLE]: {
      entry: {
        type: EAction.LOG_STATE_CHANGE,
        params: { state: EState.IDLE },
      },
      on: {
        'SCREEN.STARTING': {
          target: EState.STARTING,
          actions: [
            EAction.CLEAR_ERROR,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.IDLE,
                to: EState.STARTING,
                event: 'SCREEN.STARTING',
              },
            },
          ],
        },
      },
    },
    [EState.STARTING]: {
      entry: {
        type: EAction.LOG_STATE_CHANGE,
        params: { state: EState.STARTING },
      },
      on: {
        'SCREEN.STARTED': {
          target: EState.ACTIVE,
          actions: {
            type: EAction.LOG_TRANSITION,
            params: {
              from: EState.STARTING,
              to: EState.ACTIVE,
              event: 'SCREEN.STARTED',
            },
          },
        },
        'SCREEN.FAILED': {
          target: EState.FAILED,
          actions: [
            EAction.SET_ERROR,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.STARTING,
                to: EState.FAILED,
                event: 'SCREEN.FAILED',
              },
            },
          ],
        },
        'SCREEN.ENDED': {
          target: EState.IDLE,
          actions: [
            EAction.CLEAR_ERROR,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.STARTING,
                to: EState.IDLE,
                event: 'SCREEN.ENDED',
              },
            },
          ],
        },
        'CALL.ENDED': {
          target: EState.IDLE,
          actions: [
            EAction.CLEAR_ERROR,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.STARTING,
                to: EState.IDLE,
                event: 'CALL.ENDED',
              },
            },
          ],
        },
        'CALL.FAILED': {
          target: EState.FAILED,
          actions: [
            EAction.SET_ERROR,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.STARTING,
                to: EState.FAILED,
                event: 'CALL.FAILED',
              },
            },
          ],
        },
      },
    },
    [EState.ACTIVE]: {
      entry: {
        type: EAction.LOG_STATE_CHANGE,
        params: { state: EState.ACTIVE },
      },
      on: {
        'SCREEN.ENDING': {
          target: EState.STOPPING,
          actions: {
            type: EAction.LOG_TRANSITION,
            params: {
              from: EState.ACTIVE,
              to: EState.STOPPING,
              event: 'SCREEN.ENDING',
            },
          },
        },
        'SCREEN.ENDED': {
          target: EState.IDLE,
          actions: [
            EAction.CLEAR_ERROR,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.ACTIVE,
                to: EState.IDLE,
                event: 'SCREEN.ENDED',
              },
            },
          ],
        },
        'SCREEN.FAILED': {
          target: EState.FAILED,
          actions: [
            EAction.SET_ERROR,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.ACTIVE,
                to: EState.FAILED,
                event: 'SCREEN.FAILED',
              },
            },
          ],
        },
        'CALL.ENDED': {
          target: EState.IDLE,
          actions: [
            EAction.CLEAR_ERROR,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.ACTIVE,
                to: EState.IDLE,
                event: 'CALL.ENDED',
              },
            },
          ],
        },
        'CALL.FAILED': {
          target: EState.FAILED,
          actions: [
            EAction.SET_ERROR,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.ACTIVE,
                to: EState.FAILED,
                event: 'CALL.FAILED',
              },
            },
          ],
        },
      },
    },
    [EState.STOPPING]: {
      entry: {
        type: EAction.LOG_STATE_CHANGE,
        params: { state: EState.STOPPING },
      },
      on: {
        'SCREEN.ENDED': {
          target: EState.IDLE,
          actions: [
            EAction.CLEAR_ERROR,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.STOPPING,
                to: EState.IDLE,
                event: 'SCREEN.ENDED',
              },
            },
          ],
        },
        'SCREEN.FAILED': {
          target: EState.FAILED,
          actions: [
            EAction.SET_ERROR,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.STOPPING,
                to: EState.FAILED,
                event: 'SCREEN.FAILED',
              },
            },
          ],
        },
        'CALL.ENDED': {
          target: EState.IDLE,
          actions: [
            EAction.CLEAR_ERROR,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.STOPPING,
                to: EState.IDLE,
                event: 'CALL.ENDED',
              },
            },
          ],
        },
        'CALL.FAILED': {
          target: EState.FAILED,
          actions: [
            EAction.SET_ERROR,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.STOPPING,
                to: EState.FAILED,
                event: 'CALL.FAILED',
              },
            },
          ],
        },
      },
    },
    [EState.FAILED]: {
      entry: {
        type: EAction.LOG_STATE_CHANGE,
        params: { state: EState.FAILED },
      },
      on: {
        'SCREEN.STARTING': {
          target: EState.STARTING,
          actions: [
            EAction.CLEAR_ERROR,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.FAILED,
                to: EState.STARTING,
                event: 'SCREEN.STARTING',
              },
            },
          ],
        },
        'SCREEN.ENDED': {
          target: EState.IDLE,
          actions: [
            EAction.CLEAR_ERROR,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.FAILED,
                to: EState.IDLE,
                event: 'SCREEN.ENDED',
              },
            },
          ],
        },
        'PRESENTATION.RESET': {
          target: EState.IDLE,
          actions: [
            EAction.CLEAR_ERROR,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.FAILED,
                to: EState.IDLE,
                event: 'PRESENTATION.RESET',
              },
            },
          ],
        },
      },
    },
  },
});

export type TPresentationSnapshot = { value: EState; context: TContext };

export class PresentationStateMachine extends BaseStateMachine<
  typeof presentationMachine,
  EState,
  TContext
> {
  public constructor(callEvents: TCallEvents) {
    super(presentationMachine);

    this.subscribeCallEvents(callEvents);
  }

  public get isIdle(): boolean {
    return this.state === EState.IDLE;
  }

  public get isStarting(): boolean {
    return this.state === EState.STARTING;
  }

  public get isActive(): boolean {
    return this.state === EState.ACTIVE;
  }

  public get isStopping(): boolean {
    return this.state === EState.STOPPING;
  }

  public get isFailed(): boolean {
    return this.state === EState.FAILED;
  }

  public get isPending(): boolean {
    return this.isStarting || this.isStopping;
  }

  public get isActiveOrPending(): boolean {
    return this.isActive || this.isPending;
  }

  public get lastError(): Error | undefined {
    return this.getSnapshot().context.lastError;
  }

  public reset(): void {
    this.send({ type: 'PRESENTATION.RESET' });
  }

  public send(event: TPresentationEvent): void {
    const snapshot = this.actor.getSnapshot();

    if (!snapshot.can(event)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[PresentationStateMachine] Invalid transition: ${event.type} from ${this.state}. Event cannot be processed in current state.`,
      );

      return;
    }

    super.send(event);
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
