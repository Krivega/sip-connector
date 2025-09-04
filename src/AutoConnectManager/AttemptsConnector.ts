import { createActor } from 'xstate';

import logger from '@/logger';
import Counter from './Counter';
import stateMachine, { EEvents, EState } from './stateMachine';

import type { ActorRefFrom } from 'xstate';
import type { TStateMachineEvent } from './stateMachine';

const DEFAULT_INITIAL_COUNT = 0;
const DEFAULT_LIMIT = 30;

type TStateMachineActor = ActorRefFrom<typeof stateMachine>;

export default class AttemptsConnector {
  private readonly actor: TStateMachineActor;

  private readonly counter: Counter;

  public constructor() {
    this.counter = new Counter({
      count: DEFAULT_INITIAL_COUNT,
      initialCount: DEFAULT_INITIAL_COUNT,
      limit: DEFAULT_LIMIT,
    });

    this.actor = createActor(stateMachine);

    this.actor.start();
  }

  public get state(): EState {
    return this.actor.getSnapshot().value as EState;
  }

  // views
  public get isIdle(): boolean {
    return this.hasState(EState.IDLE);
  }

  public get isConnecting(): boolean {
    return this.hasState(EState.CONNECTING);
  }

  public get isCheckTelephony(): boolean {
    return this.hasState(EState.CHECK_TELEPHONY);
  }

  public get isCalling(): boolean {
    return this.hasState(EState.CALLING);
  }

  public get count(): number {
    return this.counter.count;
  }

  public get limit(): number {
    return this.counter.limit;
  }

  public hasLimitReached(): boolean {
    return this.counter.hasLimitReached();
  }

  // actions
  public startConnect(): void {
    this.sendEvent(EEvents.START_CONNECT);
  }

  public startCheckTelephony(): void {
    this.sendEvent(EEvents.START_CHECK_TELEPHONY);
  }

  public startCall(): void {
    this.sendEvent(EEvents.START_CALL);
  }

  public reset(): void {
    this.sendEvent(EEvents.RESET);
  }

  public destroy(): void {
    this.actor.stop();
  }

  // helpers
  private hasState(state: EState): boolean {
    return this.actor.getSnapshot().matches(state);
  }

  private sendEvent(eventName: TStateMachineEvent): void {
    const snapshot = this.actor.getSnapshot();
    const event = { type: eventName };

    if (!snapshot.can(event)) {
      logger(
        `Invalid transition: ${event.type} from ${this.state}. Event cannot be processed in current state.`,
      );

      return;
    }

    this.actor.send(event);
  }
}
