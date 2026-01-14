import { createEvents, EEvent } from './events';

import type { Subscription } from 'xstate';
import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { IncomingCallManager } from '@/IncomingCallManager';
import type { PresentationManager } from '@/PresentationManager';
import type { TEventMap, TEvents } from './events';
import type { TSessionActors, TSessionSnapshot } from './types';

type TEqualityFunction<T> = (previous: T, next: T) => boolean;
type TSelector<T> = (snapshot: TSessionSnapshot) => T;

const defaultEquals = <T>(previous: T, next: T) => {
  return Object.is(previous, next);
};

type TSessionManagerDeps = {
  connectionManager: Pick<ConnectionManager, 'connectionActor'>;
  callManager: Pick<CallManager, 'callActor'>;
  incomingCallManager: Pick<IncomingCallManager, 'incomingActor'>;
  presentationManager: Pick<PresentationManager, 'presentationActor'>;
};

const collectSnapshot = (actors: TSessionActors): TSessionSnapshot => {
  return {
    connection: actors.connection.getSnapshot(),
    call: actors.call.getSnapshot(),
    incoming: actors.incoming.getSnapshot(),
    presentation: actors.presentation.getSnapshot(),
  };
};

class SessionManager {
  public readonly events: TEvents;

  public readonly actors: TSessionActors;

  private currentSnapshot: TSessionSnapshot;

  private readonly subscribers = new Set<{
    selector: TSelector<unknown>;
    listener: (value: unknown) => void;
    equals: TEqualityFunction<unknown>;
    current: unknown;
  }>();

  private readonly actorSubscriptions: Subscription[] = [];

  public constructor(deps: TSessionManagerDeps) {
    this.events = createEvents();

    this.actors = {
      connection: deps.connectionManager.connectionActor,
      call: deps.callManager.callActor,
      incoming: deps.incomingCallManager.incomingActor,
      presentation: deps.presentationManager.presentationActor,
    };

    this.currentSnapshot = collectSnapshot(this.actors);

    this.actorSubscriptions.push(
      this.actors.connection.subscribe(this.notifySubscribers),
      this.actors.call.subscribe(this.notifySubscribers),
      this.actors.incoming.subscribe(this.notifySubscribers),
      this.actors.presentation.subscribe(this.notifySubscribers),
    );
  }

  public getSnapshot(): TSessionSnapshot {
    return this.currentSnapshot;
  }

  public subscribe(listener: (snapshot: TSessionSnapshot) => void): () => void;
  public subscribe<T>(
    selector: TSelector<T>,
    listener: (value: T) => void,
    equals?: TEqualityFunction<T>,
  ): () => void;
  public subscribe(
    selectorOrListener: TSelector<unknown> | ((snapshot: TSessionSnapshot) => void),
    maybeListener?: (value: unknown) => void,
    maybeEquals?: TEqualityFunction<unknown>,
  ) {
    const hasSelector = typeof maybeListener === 'function';

    const selector = hasSelector
      ? (selectorOrListener as TSelector<unknown>)
      : (sessionSnapshot: TSessionSnapshot) => {
          return sessionSnapshot;
        };
    const listener = hasSelector
      ? (maybeListener as (value: unknown) => void)
      : (selectorOrListener as (value: unknown) => void);
    const equals =
      (hasSelector ? (maybeEquals as TEqualityFunction<unknown> | undefined) : undefined) ??
      (defaultEquals as TEqualityFunction<unknown>);

    const current = selector(this.currentSnapshot);
    const subscriber = {
      selector,
      listener,
      equals,
      current,
    };

    this.subscribers.add(subscriber);

    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  public stop(): void {
    this.subscribers.clear();
    this.actorSubscriptions.forEach((subscription) => {
      subscription.unsubscribe();
    });
  }

  public on<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.events.on(eventName, handler);
  }

  public off<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    this.events.off(eventName, handler);
  }

  private readonly notifySubscribers = () => {
    const previousSnapshot = this.currentSnapshot;

    this.currentSnapshot = collectSnapshot(this.actors);

    for (const subscriber of this.subscribers) {
      const next = subscriber.selector(this.currentSnapshot);

      if (!subscriber.equals(subscriber.current, next)) {
        subscriber.current = next;
        subscriber.listener(next);
      }
    }

    this.events.trigger(EEvent.SNAPSHOT_CHANGED, {
      previous: previousSnapshot,
      current: this.currentSnapshot,
    });
  };
}

export default SessionManager;
