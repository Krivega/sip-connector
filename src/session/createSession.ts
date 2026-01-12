import { createActor } from 'xstate';

import { attachSessionEventAdapter } from './eventAdapter';
import { sessionMachine } from './rootMachine';

import type { TSessionEventAdapterDeps } from './eventAdapter';
import type { TSessionActor, TSessionSnapshot } from './rootMachine';

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
  actor: TSessionActor;
}

const defaultEquals = <T>(previous: T, next: T) => {
  return Object.is(previous, next);
};

export const createSession = (deps: TSessionEventAdapterDeps): ISession => {
  const actor = createActor(sessionMachine);
  const detach = attachSessionEventAdapter(actor, deps);

  actor.start();

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
      : (snapshot: TSessionSnapshot) => {
          return snapshot;
        };
    const listener = hasSelector
      ? (maybeListener as (value: unknown) => void)
      : (selectorOrListener as (value: unknown) => void);
    const equals =
      (hasSelector ? (maybeEquals as TEqualityFunction<unknown> | undefined) : undefined) ??
      (defaultEquals as TEqualityFunction<unknown>);

    let current = selector(actor.getSnapshot());

    const subscription = actor.subscribe((snapshot) => {
      const next = selector(snapshot);

      if (equals(current, next)) {
        return;
      }

      current = next;
      listener(next);
    });

    return () => {
      subscription.unsubscribe();
    };
  }

  return {
    actor,
    getSnapshot: () => {
      return actor.getSnapshot();
    },
    subscribe,
    stop: () => {
      detach();
      actor.stop();
    },
  };
};
