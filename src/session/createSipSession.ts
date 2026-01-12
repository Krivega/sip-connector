import { createActor } from 'xstate';

import { attachSessionEventAdapter } from './eventAdapter';
import { sipSessionMachine } from './rootMachine';
import {
  selectCallStatus,
  selectConnectionStatus,
  selectIncomingRemoteCaller,
  selectIncomingStatus,
  selectIsInCall,
  selectScreenShareStatus,
} from './selectors';

import type { TSessionEventAdapterDeps } from './eventAdapter';
import type { TSipSessionActor, TSipSessionSnapshot } from './rootMachine';

type EqualityFunction<T> = (previous: T, next: T) => boolean;
type Selector<T> = (snapshot: TSipSessionSnapshot) => T;

export interface ISipSession {
  getSnapshot: () => TSipSessionSnapshot;
  subscribe: <T>(
    selector: Selector<T>,
    listener: (value: T) => void,
    equals?: EqualityFunction<T>,
  ) => () => void;
  stop: () => void;
  actor: TSipSessionActor;
}

const defaultEquals = <T>(previous: T, next: T) => {
  return Object.is(previous, next);
};

export const createSipSession = (deps: TSessionEventAdapterDeps): ISipSession => {
  const actor = createActor(sipSessionMachine);
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

export const sessionSelectors = {
  selectConnectionStatus,
  selectCallStatus,
  selectIncomingStatus,
  selectIncomingRemoteCaller,
  selectScreenShareStatus,
  selectIsInCall,
};
