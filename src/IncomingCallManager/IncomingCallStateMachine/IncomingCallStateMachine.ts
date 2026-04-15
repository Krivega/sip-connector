import resolveDebug from '@/logger';
import { BaseStateMachine } from '@/tools/BaseStateMachine';
import { EEvents, EState } from './constants';
import { createIncomingCallMachine } from './createIncomingCallMachine';

import type { TEvents as TConnectionEvents } from '@/ConnectionManager/events';
import type { TEvents as TIncomingEvents, TRemoteCallerData } from '../events';
import type { TContextMap, TFinishedReason, TIncomingMachineEvents, TContext } from './types';

const incomingMachine = createIncomingCallMachine();
const debug = resolveDebug('IncomingCallStateMachine');

export type TSnapshot =
  | { value: EState.IDLE; context: TContextMap[EState.IDLE] }
  | { value: EState.RINGING; context: TContextMap[EState.RINGING] }
  | { value: EState.CONSUMED; context: TContextMap[EState.CONSUMED] }
  | { value: EState.DECLINED; context: TContextMap[EState.DECLINED] }
  | { value: EState.TERMINATED; context: TContextMap[EState.TERMINATED] }
  | { value: EState.FAILED; context: TContextMap[EState.FAILED] };

type TDeps = {
  incomingEvents: TIncomingEvents;
  connectionEvents: TConnectionEvents;
};

export class IncomingCallStateMachine extends BaseStateMachine<
  typeof incomingMachine,
  EState,
  TContext,
  TSnapshot
> {
  public constructor({ incomingEvents, connectionEvents }: TDeps) {
    super(incomingMachine);

    this.subscribeIncomingEvents(incomingEvents);
    this.subscribeConnectionEvents(connectionEvents);
  }

  public get isIdle(): boolean {
    return this.hasState(EState.IDLE);
  }

  public get isRinging(): boolean {
    return this.hasState(EState.RINGING);
  }

  public get isConsumed(): boolean {
    return this.hasState(EState.CONSUMED);
  }

  public get isDeclined(): boolean {
    return this.hasState(EState.DECLINED);
  }

  public get isTerminated(): boolean {
    return this.hasState(EState.TERMINATED);
  }

  public get isFailed(): boolean {
    return this.hasState(EState.FAILED);
  }

  public get isActive(): boolean {
    return this.isRinging;
  }

  public get isFinished(): boolean {
    return this.isConsumed || this.isDeclined || this.isTerminated || this.isFailed;
  }

  public get remoteCallerData(): TRemoteCallerData | undefined {
    return this.context.remoteCallerData;
  }

  public get lastReason(): TFinishedReason | undefined {
    return this.context.lastReason;
  }

  public readonly toConsumed = (): void => {
    this.sendEvent({ type: EEvents.CONSUMED });
  };

  public reset(): void {
    this.toClearIncoming();
  }

  public send(event: TIncomingMachineEvents): void {
    this.sendEvent(event);
  }

  private hasState(state: EState): boolean {
    return this.actor.getSnapshot().matches(state);
  }

  private sendEvent(event: TIncomingMachineEvents): void {
    const snapshot = this.actor.getSnapshot();

    if (!snapshot.can(event)) {
      debug(
        `[IncomingCallStateMachine] Invalid transition: ${event.type} from ${this.state}. Event cannot be processed in current state.`,
      );

      return;
    }

    super.send(event);
  }

  private subscribeIncomingEvents(events: TIncomingEvents): void {
    this.addSubscription(
      events.on('ringing', (data: TRemoteCallerData) => {
        this.sendEvent({ type: EEvents.RINGING, data });
      }),
    );
    this.addSubscription(
      events.on('declinedIncomingCall', (data: TRemoteCallerData) => {
        this.sendEvent({ type: EEvents.DECLINED, data });
      }),
    );
    this.addSubscription(
      events.on('terminatedIncomingCall', (data: TRemoteCallerData) => {
        this.sendEvent({ type: EEvents.TERMINATED, data });
      }),
    );
    this.addSubscription(
      events.on('failedIncomingCall', (data: TRemoteCallerData) => {
        this.sendEvent({ type: EEvents.FAILED, data });
      }),
    );
  }

  private subscribeConnectionEvents(events: TConnectionEvents): void {
    this.addSubscription(
      events.on('disconnected', () => {
        this.toClearIncoming();
      }),
    );
    this.addSubscription(
      events.on('registrationFailed', () => {
        this.toClearIncoming();
      }),
    );
    this.addSubscription(
      events.on('connect-failed', () => {
        this.toClearIncoming();
      }),
    );
  }

  private readonly toClearIncoming = (): void => {
    this.sendEvent({ type: EEvents.CLEAR });
  };
}
