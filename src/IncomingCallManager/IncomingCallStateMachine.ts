import { assign, setup } from 'xstate';

import { EEvent as EConnectionEvent } from '@/ConnectionManager/events';
import { BaseStateMachine } from '@/tools/BaseStateMachine';

import type { ActorRefFrom, SnapshotFrom } from 'xstate';
import type { TEvents as TConnectionEvents } from '@/ConnectionManager/events';
import type { TEvents as TIncomingEvents, TRemoteCallerData } from './events';

export enum EState {
  IDLE = 'incoming:idle',
  RINGING = 'incoming:ringing',
  CONSUMED = 'incoming:consumed',
  DECLINED = 'incoming:declined',
  TERMINATED = 'incoming:terminated',
  FAILED = 'incoming:failed',
}

type TIncomingEvent =
  | { type: 'INCOMING.RINGING'; data: TRemoteCallerData }
  | { type: 'INCOMING.CONSUMED' }
  | { type: 'INCOMING.DECLINED'; data: TRemoteCallerData }
  | { type: 'INCOMING.TERMINATED'; data: TRemoteCallerData }
  | { type: 'INCOMING.FAILED'; data: TRemoteCallerData }
  | { type: 'INCOMING.CLEAR' };

interface IIncomingContext {
  remoteCallerData?: TRemoteCallerData;
  lastReason?: EState.CONSUMED | EState.DECLINED | EState.TERMINATED | EState.FAILED;
}

const incomingMachine = setup({
  types: {
    context: {} as IIncomingContext,
    events: {} as TIncomingEvent,
  },
  actions: {
    rememberIncoming: assign(({ event }) => {
      const { data } = event as { data: TRemoteCallerData };

      return { remoteCallerData: data, lastReason: undefined };
    }),
    rememberReason: assign(({ event, context }) => {
      if (event.type === 'INCOMING.CONSUMED') {
        return { remoteCallerData: context.remoteCallerData, lastReason: EState.CONSUMED };
      }

      if (event.type === 'INCOMING.DECLINED') {
        return { remoteCallerData: event.data, lastReason: EState.DECLINED };
      }

      if (event.type === 'INCOMING.TERMINATED') {
        return { remoteCallerData: event.data, lastReason: EState.TERMINATED };
      }

      // INCOMING.FAILED
      return {
        remoteCallerData: (event as { data: TRemoteCallerData }).data,
        lastReason: EState.FAILED,
      };
    }),
    clearIncoming: assign(() => {
      return { remoteCallerData: undefined, lastReason: undefined };
    }),
  },
}).createMachine({
  id: 'incoming',
  initial: EState.IDLE,
  context: {},
  states: {
    [EState.IDLE]: {
      on: {
        'INCOMING.RINGING': {
          target: EState.RINGING,
          actions: ['rememberIncoming'],
        },
        'INCOMING.CLEAR': {
          target: EState.IDLE,
          actions: 'clearIncoming',
        },
      },
    },
    [EState.RINGING]: {
      on: {
        'INCOMING.RINGING': {
          target: EState.RINGING,
          actions: ['rememberIncoming'],
        },
        'INCOMING.CONSUMED': {
          target: EState.CONSUMED,
          actions: 'rememberReason',
        },
        'INCOMING.DECLINED': {
          target: EState.DECLINED,
          actions: 'rememberReason',
        },
        'INCOMING.TERMINATED': {
          target: EState.TERMINATED,
          actions: 'rememberReason',
        },
        'INCOMING.FAILED': {
          target: EState.FAILED,
          actions: 'rememberReason',
        },
        'INCOMING.CLEAR': {
          target: EState.IDLE,
          actions: 'clearIncoming',
        },
      },
    },
    [EState.CONSUMED]: {
      on: {
        'INCOMING.CLEAR': {
          target: EState.IDLE,
          actions: 'clearIncoming',
        },
        'INCOMING.RINGING': {
          target: EState.RINGING,
          actions: ['rememberIncoming'],
        },
      },
    },
    [EState.DECLINED]: {
      on: {
        'INCOMING.CLEAR': {
          target: EState.IDLE,
          actions: 'clearIncoming',
        },
        'INCOMING.RINGING': {
          target: EState.RINGING,
          actions: ['rememberIncoming'],
        },
      },
    },
    [EState.TERMINATED]: {
      on: {
        'INCOMING.CLEAR': {
          target: EState.IDLE,
          actions: 'clearIncoming',
        },
        'INCOMING.RINGING': {
          target: EState.RINGING,
          actions: ['rememberIncoming'],
        },
      },
    },
    [EState.FAILED]: {
      on: {
        'INCOMING.CLEAR': {
          target: EState.IDLE,
          actions: 'clearIncoming',
        },
        'INCOMING.RINGING': {
          target: EState.RINGING,
          actions: ['rememberIncoming'],
        },
      },
    },
  },
});

export type TIncomingSnapshot = SnapshotFrom<typeof incomingMachine>;
export type TIncomingActor = ActorRefFrom<typeof incomingMachine>;

type TDeps = {
  incomingEvents: TIncomingEvents;
  connectionEvents: TConnectionEvents;
};

export class IncomingCallStateMachine extends BaseStateMachine<typeof incomingMachine, EState> {
  public constructor({ incomingEvents, connectionEvents }: TDeps) {
    super(incomingMachine);

    this.subscribeIncomingEvents(incomingEvents);
    this.subscribeConnectionEvents(connectionEvents);
  }

  public toConsumed() {
    this.send({ type: 'INCOMING.CONSUMED' });
  }

  private subscribeIncomingEvents(events: TIncomingEvents) {
    this.addSubscription(
      events.on('incomingCall', (data: TRemoteCallerData) => {
        this.send({ type: 'INCOMING.RINGING', data });
      }),
    );
    this.addSubscription(
      events.on('declinedIncomingCall', (data: TRemoteCallerData) => {
        this.send({ type: 'INCOMING.DECLINED', data });
      }),
    );
    this.addSubscription(
      events.on('terminatedIncomingCall', (data: TRemoteCallerData) => {
        this.send({ type: 'INCOMING.TERMINATED', data });
      }),
    );
    this.addSubscription(
      events.on('failedIncomingCall', (data: TRemoteCallerData) => {
        this.send({ type: 'INCOMING.FAILED', data });
      }),
    );
  }

  private subscribeConnectionEvents(events: TConnectionEvents) {
    this.addSubscription(
      events.on(EConnectionEvent.DISCONNECTED, () => {
        this.toClearIncoming();
      }),
    );
    this.addSubscription(
      events.on(EConnectionEvent.REGISTRATION_FAILED, () => {
        this.toClearIncoming();
      }),
    );
    this.addSubscription(
      events.on(EConnectionEvent.CONNECT_FAILED, () => {
        this.toClearIncoming();
      }),
    );
  }

  private toClearIncoming() {
    this.send({ type: 'INCOMING.CLEAR' });
  }
}
