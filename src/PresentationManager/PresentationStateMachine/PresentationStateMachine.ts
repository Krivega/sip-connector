import resolveDebug from '@/logger';
import { BaseStateMachine } from '@/tools/BaseStateMachine';
import { EEvents, EState } from './constants';
import { createPresentationMachine } from './createPresentationMachine';

import type { TCallEvents } from '@/CallManager';
import type { TContext, TContextMap, TPresentationMachineEvents } from './types';

const presentationMachine = createPresentationMachine();
const debug = resolveDebug('PresentationStateMachine');

export type TSnapshot =
  | { value: EState.IDLE; context: TContextMap[EState.IDLE] }
  | { value: EState.STARTING; context: TContextMap[EState.STARTING] }
  | { value: EState.ACTIVE; context: TContextMap[EState.ACTIVE] }
  | { value: EState.STOPPING; context: TContextMap[EState.STOPPING] }
  | { value: EState.FAILED; context: TContextMap[EState.FAILED] };

export class PresentationStateMachine extends BaseStateMachine<
  typeof presentationMachine,
  EState,
  TContext,
  TSnapshot
> {
  public constructor(callEvents: TCallEvents) {
    super(presentationMachine);

    this.subscribeCallEvents(callEvents);
  }

  public get isIdle(): boolean {
    return this.hasState(EState.IDLE);
  }

  public get isStarting(): boolean {
    return this.hasState(EState.STARTING);
  }

  public get isActive(): boolean {
    return this.hasState(EState.ACTIVE);
  }

  public get isStopping(): boolean {
    return this.hasState(EState.STOPPING);
  }

  public get isFailed(): boolean {
    return this.hasState(EState.FAILED);
  }

  public get isPending(): boolean {
    return this.isStarting || this.isStopping;
  }

  public get isActiveOrPending(): boolean {
    return this.isActive || this.isPending;
  }

  public get lastError(): Error | undefined {
    return this.context.lastError;
  }

  public reset(): void {
    this.sendEvent({ type: EEvents.PRESENTATION_RESET });
  }

  public send(event: TPresentationMachineEvents): void {
    this.sendEvent(event);
  }

  private hasState(state: EState): boolean {
    return this.actor.getSnapshot().matches(state);
  }

  private sendEvent(event: TPresentationMachineEvents): void {
    const snapshot = this.actor.getSnapshot();

    if (!snapshot.can(event)) {
      debug(
        `[PresentationStateMachine] Invalid transition: ${event.type} from ${this.state}. Event cannot be processed in current state.`,
      );

      return;
    }

    super.send(event);
  }

  private subscribeCallEvents(events: TCallEvents): void {
    this.addSubscription(
      events.on('presentation:start', () => {
        this.sendEvent({ type: EEvents.SCREEN_STARTING });
      }),
    );
    this.addSubscription(
      events.on('presentation:started', () => {
        this.sendEvent({ type: EEvents.SCREEN_STARTED });
      }),
    );
    this.addSubscription(
      events.on('presentation:end', () => {
        this.sendEvent({ type: EEvents.SCREEN_ENDING });
      }),
    );
    this.addSubscription(
      events.on('presentation:ended', () => {
        this.sendEvent({ type: EEvents.SCREEN_ENDED });
      }),
    );
    this.addSubscription(
      events.on('presentation:failed', (error) => {
        this.sendEvent({ type: EEvents.SCREEN_FAILED, error });
      }),
    );
    this.addSubscription(
      events.on('ended', () => {
        this.sendEvent({ type: EEvents.CALL_ENDED });
      }),
    );
    this.addSubscription(
      events.on('failed', (error) => {
        this.sendEvent({ type: EEvents.CALL_FAILED, error });
      }),
    );
  }
}
