import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { IncomingCallManager } from '@/IncomingCallManager';
import type { PresentationManager } from '@/PresentationManager';
import type { TSessionActors, TSessionSnapshot } from './types';

type TEqualityFunction<T> = (previous: T, next: T) => boolean;
type TSelector<T> = (snapshot: TSessionSnapshot) => T;

type TSubscribeOverload = {
  (listener: (snapshot: TSessionSnapshot) => void): () => void;
  <T>(
    selector: TSelector<T>,
    listener: (value: T) => void,
    equals?: TEqualityFunction<T>,
  ): () => void;
};

export interface ISession {
  getSnapshot: () => TSessionSnapshot;
  subscribe: TSubscribeOverload;
  stop: () => void;
  actors: TSessionActors;
  actor: TSessionActors;
}

const defaultEquals = <T>(previous: T, next: T) => {
  return Object.is(previous, next);
};

type TSessionDeps = {
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

export const createSession = (deps: TSessionDeps): ISession => {
  const actors: TSessionActors = {
    connection: deps.connectionManager.connectionActor,
    call: deps.callManager.callActor,
    incoming: deps.incomingCallManager.incomingActor,
    presentation: deps.presentationManager.presentationActor,
  };

  let currentSnapshot = collectSnapshot(actors);
  const subscribers = new Set<{
    selector: TSelector<unknown>;
    listener: (value: unknown) => void;
    equals: TEqualityFunction<unknown>;
    current: unknown;
  }>();

  const notifySubscribers = () => {
    currentSnapshot = collectSnapshot(actors);

    for (const subscriber of subscribers) {
      const next = subscriber.selector(currentSnapshot);

      if (!subscriber.equals(subscriber.current, next)) {
        subscriber.current = next;
        subscriber.listener(next);
      }
    }
  };

  const actorSubscriptions = [
    actors.connection.subscribe(notifySubscribers),
    actors.call.subscribe(notifySubscribers),
    actors.incoming.subscribe(notifySubscribers),
    actors.presentation.subscribe(notifySubscribers),
  ];

  function subscribe(listener: (snapshot: TSessionSnapshot) => void): () => void;
  function subscribe<T>(
    selector: TSelector<T>,
    listener: (value: T) => void,
    equals?: TEqualityFunction<T>,
  ): () => void;
  function subscribe(
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

    const current = selector(currentSnapshot);
    const subscriber = {
      selector,
      listener,
      equals,
      current,
    };

    subscribers.add(subscriber);

    return () => {
      subscribers.delete(subscriber);
    };
  }

  return {
    actor: actors,
    actors,
    getSnapshot: () => {
      return currentSnapshot;
    },
    subscribe,
    stop: () => {
      subscribers.clear();
      actorSubscriptions.forEach((subscription) => {
        subscription.unsubscribe();
      });
    },
  };
};
