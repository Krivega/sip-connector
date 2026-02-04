import { assign, setup } from 'xstate';

import { EEvent as EConnectionEvent } from '@/ConnectionManager/events';
import logger from '@/logger';
import { BaseStateMachine } from '@/tools/BaseStateMachine';

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

enum EAction {
  LOG_TRANSITION = 'logTransition',
  LOG_STATE_CHANGE = 'logStateChange',
  REMEMBER_INCOMING = 'rememberIncoming',
  REMEMBER_REASON = 'rememberReason',
  CLEAR_INCOMING = 'clearIncoming',
}

type TIncomingEvent =
  | { type: 'INCOMING.RINGING'; data: TRemoteCallerData }
  | { type: 'INCOMING.CONSUMED' }
  | { type: 'INCOMING.DECLINED'; data: TRemoteCallerData }
  | { type: 'INCOMING.TERMINATED'; data: TRemoteCallerData }
  | { type: 'INCOMING.FAILED'; data: TRemoteCallerData }
  | { type: 'INCOMING.CLEAR' };

type TContext = {
  remoteCallerData?: TRemoteCallerData;
  lastReason?: EState.CONSUMED | EState.DECLINED | EState.TERMINATED | EState.FAILED;
};

const incomingMachine = setup({
  types: {
    context: {} as TContext,
    events: {} as TIncomingEvent,
  },
  actions: {
    [EAction.LOG_TRANSITION]: (_, params: { from: string; to: string; event: string }) => {
      logger(`State transition: ${params.from} -> ${params.to} (${params.event})`);
    },
    [EAction.LOG_STATE_CHANGE]: (_, params: { state: string }) => {
      logger('IncomingCallStateMachine state changed', params.state);
    },
    [EAction.REMEMBER_INCOMING]: assign(({ event }) => {
      const { data } = event as { data: TRemoteCallerData };

      return { remoteCallerData: data, lastReason: undefined };
    }),
    [EAction.REMEMBER_REASON]: assign(({ event, context }) => {
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
    [EAction.CLEAR_INCOMING]: assign(() => {
      return { remoteCallerData: undefined, lastReason: undefined };
    }),
  },
}).createMachine({
  id: 'incoming',
  initial: EState.IDLE,
  context: {},
  states: {
    [EState.IDLE]: {
      entry: {
        type: EAction.LOG_STATE_CHANGE,
        params: { state: EState.IDLE },
      },
      on: {
        'INCOMING.RINGING': {
          target: EState.RINGING,
          actions: [
            EAction.REMEMBER_INCOMING,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.IDLE,
                to: EState.RINGING,
                event: 'INCOMING.RINGING',
              },
            },
          ],
        },
        'INCOMING.CLEAR': {
          target: EState.IDLE,
          actions: [
            EAction.CLEAR_INCOMING,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.IDLE,
                to: EState.IDLE,
                event: 'INCOMING.CLEAR',
              },
            },
          ],
        },
      },
    },
    [EState.RINGING]: {
      entry: {
        type: EAction.LOG_STATE_CHANGE,
        params: { state: EState.RINGING },
      },
      on: {
        'INCOMING.RINGING': {
          target: EState.RINGING,
          actions: [
            EAction.REMEMBER_INCOMING,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.RINGING,
                to: EState.RINGING,
                event: 'INCOMING.RINGING',
              },
            },
          ],
        },
        'INCOMING.CONSUMED': {
          target: EState.CONSUMED,
          actions: [
            EAction.REMEMBER_REASON,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.RINGING,
                to: EState.CONSUMED,
                event: 'INCOMING.CONSUMED',
              },
            },
          ],
        },
        'INCOMING.DECLINED': {
          target: EState.DECLINED,
          actions: [
            EAction.REMEMBER_REASON,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.RINGING,
                to: EState.DECLINED,
                event: 'INCOMING.DECLINED',
              },
            },
          ],
        },
        'INCOMING.TERMINATED': {
          target: EState.TERMINATED,
          actions: [
            EAction.REMEMBER_REASON,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.RINGING,
                to: EState.TERMINATED,
                event: 'INCOMING.TERMINATED',
              },
            },
          ],
        },
        'INCOMING.FAILED': {
          target: EState.FAILED,
          actions: [
            EAction.REMEMBER_REASON,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.RINGING,
                to: EState.FAILED,
                event: 'INCOMING.FAILED',
              },
            },
          ],
        },
        'INCOMING.CLEAR': {
          target: EState.IDLE,
          actions: [
            EAction.CLEAR_INCOMING,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.RINGING,
                to: EState.IDLE,
                event: 'INCOMING.CLEAR',
              },
            },
          ],
        },
      },
    },
    [EState.CONSUMED]: {
      entry: {
        type: EAction.LOG_STATE_CHANGE,
        params: { state: EState.CONSUMED },
      },
      on: {
        'INCOMING.CLEAR': {
          target: EState.IDLE,
          actions: [
            EAction.CLEAR_INCOMING,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.CONSUMED,
                to: EState.IDLE,
                event: 'INCOMING.CLEAR',
              },
            },
          ],
        },
        'INCOMING.RINGING': {
          target: EState.RINGING,
          actions: [
            EAction.REMEMBER_INCOMING,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.CONSUMED,
                to: EState.RINGING,
                event: 'INCOMING.RINGING',
              },
            },
          ],
        },
      },
    },
    [EState.DECLINED]: {
      entry: {
        type: EAction.LOG_STATE_CHANGE,
        params: { state: EState.DECLINED },
      },
      on: {
        'INCOMING.CLEAR': {
          target: EState.IDLE,
          actions: [
            EAction.CLEAR_INCOMING,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.DECLINED,
                to: EState.IDLE,
                event: 'INCOMING.CLEAR',
              },
            },
          ],
        },
        'INCOMING.RINGING': {
          target: EState.RINGING,
          actions: [
            EAction.REMEMBER_INCOMING,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.DECLINED,
                to: EState.RINGING,
                event: 'INCOMING.RINGING',
              },
            },
          ],
        },
      },
    },
    [EState.TERMINATED]: {
      entry: {
        type: EAction.LOG_STATE_CHANGE,
        params: { state: EState.TERMINATED },
      },
      on: {
        'INCOMING.CLEAR': {
          target: EState.IDLE,
          actions: [
            EAction.CLEAR_INCOMING,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.TERMINATED,
                to: EState.IDLE,
                event: 'INCOMING.CLEAR',
              },
            },
          ],
        },
        'INCOMING.RINGING': {
          target: EState.RINGING,
          actions: [
            EAction.REMEMBER_INCOMING,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.TERMINATED,
                to: EState.RINGING,
                event: 'INCOMING.RINGING',
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
        'INCOMING.CLEAR': {
          target: EState.IDLE,
          actions: [
            EAction.CLEAR_INCOMING,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.FAILED,
                to: EState.IDLE,
                event: 'INCOMING.CLEAR',
              },
            },
          ],
        },
        'INCOMING.RINGING': {
          target: EState.RINGING,
          actions: [
            EAction.REMEMBER_INCOMING,
            {
              type: EAction.LOG_TRANSITION,
              params: {
                from: EState.FAILED,
                to: EState.RINGING,
                event: 'INCOMING.RINGING',
              },
            },
          ],
        },
      },
    },
  },
});

export type TIncomingSnapshot = { value: EState; context: TContext };

type TDeps = {
  incomingEvents: TIncomingEvents;
  connectionEvents: TConnectionEvents;
};

export class IncomingCallStateMachine extends BaseStateMachine<
  typeof incomingMachine,
  EState,
  TContext
> {
  public constructor({ incomingEvents, connectionEvents }: TDeps) {
    super(incomingMachine);

    this.subscribeIncomingEvents(incomingEvents);
    this.subscribeConnectionEvents(connectionEvents);
  }

  public get isIdle(): boolean {
    return this.state === EState.IDLE;
  }

  public get isRinging(): boolean {
    return this.state === EState.RINGING;
  }

  public get isConsumed(): boolean {
    return this.state === EState.CONSUMED;
  }

  public get isDeclined(): boolean {
    return this.state === EState.DECLINED;
  }

  public get isTerminated(): boolean {
    return this.state === EState.TERMINATED;
  }

  public get isFailed(): boolean {
    return this.state === EState.FAILED;
  }

  public get isActive(): boolean {
    return this.isRinging;
  }

  public get isFinished(): boolean {
    return this.isConsumed || this.isDeclined || this.isTerminated || this.isFailed;
  }

  public get remoteCallerData(): TRemoteCallerData | undefined {
    return this.getSnapshot().context.remoteCallerData;
  }

  public get lastReason():
    | EState.CONSUMED
    | EState.DECLINED
    | EState.TERMINATED
    | EState.FAILED
    | undefined {
    return this.getSnapshot().context.lastReason;
  }

  public reset(): void {
    this.send({ type: 'INCOMING.CLEAR' });
  }

  public send(event: TIncomingEvent): void {
    const snapshot = this.actor.getSnapshot();

    if (!snapshot.can(event)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[IncomingCallStateMachine] Invalid transition: ${event.type} from ${this.state}. Event cannot be processed in current state.`,
      );

      return;
    }

    super.send(event);
  }

  public toConsumed() {
    this.send({ type: 'INCOMING.CONSUMED' });
  }

  private subscribeIncomingEvents(events: TIncomingEvents) {
    this.addSubscription(
      events.on('ringing', (data: TRemoteCallerData) => {
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
