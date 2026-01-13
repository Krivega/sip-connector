import { createEvents, EEvent } from './events';

import type { TEventMap, TEvents } from './events';
import type { TConferenceState, TConferenceStateUpdate } from './types';

class ConferenceStateManager {
  public readonly events: TEvents;

  private state: TConferenceState = {};

  public constructor() {
    this.events = createEvents();
  }

  public getState(): Readonly<TConferenceState> {
    return { ...this.state };
  }

  public updateState(updates: TConferenceStateUpdate): void {
    const previousState = { ...this.state };

    this.state = { ...this.state, ...updates };
    this.events.trigger(EEvent.STATE_CHANGED, {
      previous: previousState,
      current: this.state,
      updates,
    });
  }

  public reset(): void {
    this.state = {};
    this.events.trigger(EEvent.STATE_RESET, {});
  }

  public getToken(): string | undefined {
    return this.state.token;
  }

  public getRoom(): string | undefined {
    return this.state.room;
  }

  public getParticipantName(): string | undefined {
    return this.state.participantName;
  }

  public getChannels(): TConferenceState['channels'] {
    return this.state.channels;
  }

  public getConference(): string | undefined {
    return this.state.conference;
  }

  public getParticipant(): string | undefined {
    return this.state.participant;
  }

  public getNumber(): string | undefined {
    return this.state.number;
  }

  public getAnswer(): boolean | undefined {
    return this.state.answer;
  }

  public on<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.events.on(eventName, handler);
  }

  public once<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.events.once(eventName, handler);
  }

  public off<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    this.events.off(eventName, handler);
  }
}

export default ConferenceStateManager;
