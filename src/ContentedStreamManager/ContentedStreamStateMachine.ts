import { assign, setup } from 'xstate';

import { BaseStateMachine } from '@/tools/BaseStateMachine';

import type { TApiManagerEvents, EContentedStreamCodec } from '@/ApiManager';
import type { TContentedStreamStateInfo } from './types';

export enum EState {
  NOT_AVAILABLE = 'contented-stream:not-available',
  AVAILABLE = 'contented-stream:available',
}

type TContentedStreamEvent =
  | { type: 'CONTENTED_STREAM.AVAILABLE'; codec?: EContentedStreamCodec }
  | { type: 'CONTENTED_STREAM.NOT_AVAILABLE' }
  | { type: 'CONTENTED_STREAM.RESET' };

type TContext = {
  codec?: EContentedStreamCodec;
};

const contentedStreamMachine = setup({
  types: {
    context: {} as TContext,
    events: {} as TContentedStreamEvent,
  },
  actions: {
    setCodec: assign(({ event }) => {
      if ('codec' in event) {
        return { codec: event.codec };
      }

      return {};
    }),
    clearCodec: assign({ codec: undefined }),
  },
}).createMachine({
  id: 'contented-stream',
  initial: EState.NOT_AVAILABLE,
  context: {},
  states: {
    [EState.NOT_AVAILABLE]: {
      on: {
        'CONTENTED_STREAM.AVAILABLE': {
          target: EState.AVAILABLE,
          actions: 'setCodec',
        },
      },
    },
    [EState.AVAILABLE]: {
      on: {
        'CONTENTED_STREAM.NOT_AVAILABLE': {
          target: EState.NOT_AVAILABLE,
          actions: 'clearCodec',
        },
        'CONTENTED_STREAM.AVAILABLE': {
          target: EState.AVAILABLE,
          actions: 'setCodec',
          reenter: true,
        },
        'CONTENTED_STREAM.RESET': {
          target: EState.NOT_AVAILABLE,
          actions: 'clearCodec',
        },
      },
    },
  },
});

export type TContentedStreamSnapshot = { value: EState; context: TContext };

export class ContentedStreamStateMachine extends BaseStateMachine<
  typeof contentedStreamMachine,
  EState,
  TContext
> {
  public constructor() {
    super(contentedStreamMachine);
  }

  public get isAvailable(): boolean {
    return this.state === EState.AVAILABLE;
  }

  public get isNotAvailable(): boolean {
    return this.state === EState.NOT_AVAILABLE;
  }

  public get codec(): EContentedStreamCodec | undefined {
    return this.getSnapshot().context.codec;
  }

  public getStateInfo(): TContentedStreamStateInfo {
    return {
      isAvailable: this.isAvailable,
      codec: this.codec,
    };
  }

  public reset(): void {
    this.send({ type: 'CONTENTED_STREAM.RESET' });
  }

  public send(event: TContentedStreamEvent): void {
    const snapshot = this.actor.getSnapshot();

    if (!snapshot.can(event)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[ContentedStreamStateMachine] Invalid transition: ${event.type} from ${this.state}. Event cannot be processed in current state.`,
      );

      return;
    }

    super.send(event);
  }

  public subscribeToApiEvents(apiManager: TApiManagerEvents): void {
    this.addSubscription(
      apiManager.on('contented-stream:available', (event) => {
        this.send({ type: 'CONTENTED_STREAM.AVAILABLE', codec: event.codec });
      }),
    );

    this.addSubscription(
      apiManager.on('contented-stream:not-available', () => {
        this.send({ type: 'CONTENTED_STREAM.NOT_AVAILABLE' });
      }),
    );
  }
}
