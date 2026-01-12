import { createActor } from 'xstate';

import { attachSessionEventAdapter } from './eventAdapter';
import { sessionMachine } from './rootMachine';

import type { TSessionEventAdapterDeps } from './eventAdapter';
import type { TSessionActor, TSessionSnapshot } from './rootMachine';

type EqualityFunction<T> = (previous: T, next: T) => boolean;
type Selector<T> = (snapshot: TSessionSnapshot) => T;

export interface ISession {
  getSnapshot: () => TSessionSnapshot;
  subscribe: <T>(
    selector: Selector<T>,
    listener: (value: T) => void,
    equals?: EqualityFunction<T>,
  ) => () => void;
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

  const subscribe = <T>(
    selector: Selector<T>,
    listener: (value: T) => void,
    equals: EqualityFunction<T> = defaultEquals,
  ) => {
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
  };

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
