import { assign, setup } from 'xstate';

import { BaseStateMachine } from '@/tools/BaseStateMachine';

import type { ActorRefFrom, SnapshotFrom } from 'xstate';
import type { TEvents } from './events';

export enum EState {
  IDLE = 'call:idle',
  CONNECTING = 'call:connecting',
  ACCEPTED = 'call:accepted',
  IN_CALL = 'call:inCall',
  ENDED = 'call:ended',
  FAILED = 'call:failed',
}

type TCallEvent =
  | { type: 'CALL.CONNECTING' }
  | { type: 'CALL.ACCEPTED' }
  | { type: 'CALL.CONFIRMED' }
  | { type: 'CALL.ENDED' }
  | { type: 'CALL.FAILED'; error?: unknown }
  | { type: 'CALL.RESET' };

interface ICallContext {
  lastError?: Error;
}

const callMachine = setup({
  types: {
    context: {} as ICallContext,
    events: {} as TCallEvent,
  },
  actions: {
    rememberError: assign(({ event }) => {
      if ('error' in event && event.error !== undefined) {
        return {
          lastError:
            event.error instanceof Error ? event.error : new Error(JSON.stringify(event.error)),
        };
      }

      return { lastError: undefined };
    }),
    resetError: assign({ lastError: undefined }),
  },
}).createMachine({
  id: 'call',
  initial: EState.IDLE,
  context: {},
  states: {
    [EState.IDLE]: {
      on: {
        'CALL.CONNECTING': {
          target: EState.CONNECTING,
          actions: 'resetError',
        },
      },
    },
    [EState.CONNECTING]: {
      on: {
        'CALL.ACCEPTED': EState.ACCEPTED,
        'CALL.ENDED': EState.ENDED,
        'CALL.FAILED': {
          target: EState.FAILED,
          actions: 'rememberError',
        },
      },
    },
    [EState.ACCEPTED]: {
      on: {
        'CALL.CONFIRMED': EState.IN_CALL,
        'CALL.ENDED': EState.ENDED,
        'CALL.FAILED': {
          target: EState.FAILED,
          actions: 'rememberError',
        },
      },
    },
    [EState.IN_CALL]: {
      on: {
        'CALL.ENDED': EState.ENDED,
        'CALL.FAILED': {
          target: EState.FAILED,
          actions: 'rememberError',
        },
      },
    },
    [EState.ENDED]: {
      on: {
        'CALL.RESET': {
          target: EState.IDLE,
          actions: 'resetError',
        },
        'CALL.CONNECTING': {
          target: EState.CONNECTING,
          actions: 'resetError',
        },
      },
    },
    [EState.FAILED]: {
      on: {
        'CALL.RESET': {
          target: EState.IDLE,
          actions: 'resetError',
        },
        'CALL.CONNECTING': {
          target: EState.CONNECTING,
          actions: 'resetError',
        },
        'CALL.ENDED': {
          target: EState.ENDED,
          actions: 'resetError',
        },
      },
    },
  },
});

export type TCallSnapshot = SnapshotFrom<typeof callMachine>;
export type TCallActor = ActorRefFrom<typeof callMachine>;

export class CallStateMachine extends BaseStateMachine<typeof callMachine, EState> {
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

  public get isAccepted(): boolean {
    return this.state === EState.ACCEPTED;
  }

  public get isInCall(): boolean {
    return this.state === EState.IN_CALL;
  }

  public get isEnded(): boolean {
    return this.state === EState.ENDED;
  }

  public get isFailed(): boolean {
    return this.state === EState.FAILED;
  }

  public get isActive(): boolean {
    return this.isAccepted || this.isInCall;
  }

  public get isPending(): boolean {
    return this.isConnecting;
  }

  public get lastError(): Error | undefined {
    return this.getSnapshot().context.lastError;
  }

  public reset(): void {
    this.send({ type: 'CALL.RESET' });
  }

  public send(event: TCallEvent): void {
    const snapshot = this.getSnapshot();

    if (!snapshot.can(event)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[CallStateMachine] Invalid transition: ${event.type} from ${this.state}. Event cannot be processed in current state.`,
      );

      return;
    }

    super.send(event);
  }

  private subscribeToEvents(events: TEvents) {
    this.addSubscription(
      events.on('connecting', () => {
        this.send({ type: 'CALL.CONNECTING' });
      }),
    );
    // Убрана подписка на progress - событие не приходит в реальном flow
    this.addSubscription(
      events.on('accepted', () => {
        this.send({ type: 'CALL.ACCEPTED' });
      }),
    );
    this.addSubscription(
      events.on('confirmed', () => {
        this.send({ type: 'CALL.CONFIRMED' });
      }),
    );
    this.addSubscription(
      events.on('ended', () => {
        this.send({ type: 'CALL.ENDED' });
      }),
    );
    this.addSubscription(
      events.on('failed', (error) => {
        this.send({ type: 'CALL.FAILED', error });
      }),
    );
  }
}
