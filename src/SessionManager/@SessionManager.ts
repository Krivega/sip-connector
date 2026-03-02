import { EventEmitterProxy } from 'events-constructor';

import { createEvents, EEvent } from './events';

import type { Subscription } from 'xstate';
import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { IncomingCallManager } from '@/IncomingCallManager';
import type { PresentationManager } from '@/PresentationManager';
import type { TEventMap } from './events';
import type { TSessionMachines, TSessionSnapshot } from './types';

type TEqualityFunction<T> = (previous: T, next: T) => boolean;
type TSelector<T> = (snapshot: TSessionSnapshot) => T;

const defaultEquals = <T>(previous: T, next: T) => {
  return Object.is(previous, next);
};

type TSessionManagerDeps = {
  connectionManager: Pick<ConnectionManager, 'stateMachine'>;
  callManager: Pick<CallManager, 'stateMachine'>;
  incomingCallManager: Pick<IncomingCallManager, 'stateMachine'>;
  presentationManager: Pick<PresentationManager, 'stateMachine'>;
};

const collectSnapshot = (machines: TSessionMachines): TSessionSnapshot => {
  return {
    connection: machines.connection.getSnapshot(),
    call: machines.call.getSnapshot(),
    incoming: machines.incoming.getSnapshot(),
    presentation: machines.presentation.getSnapshot(),
  };
};

class SessionManager extends EventEmitterProxy<TEventMap> {
  public readonly machines: TSessionMachines;

  private currentSnapshot: TSessionSnapshot;

  private readonly subscribers = new Set<{
    selector: TSelector<unknown>;
    listener: (value: unknown) => void;
    equals: TEqualityFunction<unknown>;
    current: unknown;
  }>();

  private readonly actorSubscriptions: Subscription[] = [];

  public constructor(deps: TSessionManagerDeps) {
    super(createEvents());

    this.machines = {
      connection: deps.connectionManager.stateMachine,
      call: deps.callManager.stateMachine,
      incoming: deps.incomingCallManager.stateMachine,
      presentation: deps.presentationManager.stateMachine,
    };

    this.currentSnapshot = collectSnapshot(this.machines);

    this.actorSubscriptions.push(
      this.machines.connection.subscribe(this.notifySubscribers),
      this.machines.call.subscribe(this.notifySubscribers),
      this.machines.incoming.subscribe(this.notifySubscribers),
      this.machines.presentation.subscribe(this.notifySubscribers),
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

  private readonly notifySubscribers = () => {
    const previousSnapshot = this.currentSnapshot;

    this.currentSnapshot = collectSnapshot(this.machines);

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
