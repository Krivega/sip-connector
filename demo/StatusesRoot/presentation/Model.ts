import { types } from 'mobx-state-tree';

import { EPresentationStatus as EState, sessionSelectors } from '@/index';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type {
  TSessionSnapshot,
  TPresentationContextMap,
  TPresentationSnapshot as TSnapshot,
} from '@/index';

type TSnapshotByState<TState extends EState> = TState extends EState
  ? Extract<TSnapshot, { value: TState }> extends { context: infer TContext }
    ? { state: TState; context: TContext }
    : never
  : never;

export type TPresentationStatusSnapshot = TSnapshotByState<EState>;

export const createPresentationStatusSnapshotFromSession = (
  snapshot: TSessionSnapshot,
): TSnapshotByState<EState> => {
  const state = sessionSelectors.selectPresentationStatus(snapshot);
  const {
    presentation: { context },
  } = snapshot;

  return {
    state,
    context,
  } as TPresentationStatusSnapshot;
};

export const PresentationStatusModel = types
  .model({
    state: types.enumeration('PresentationStatus', [
      EState.IDLE,
      EState.STARTING,
      EState.ACTIVE,
      EState.STOPPING,
      EState.FAILED,
    ]),
    context: types.frozen<TPresentationContextMap[EState]>(),
  })
  .views((self) => {
    return {
      get snapshot(): TSnapshotByState<EState> {
        return { state: self.state, context: self.context } as TPresentationStatusSnapshot;
      },
    };
  })
  .views((self) => {
    return {
      isIdle: (): boolean => {
        return self.state === EState.IDLE;
      },
      isStarting: (): boolean => {
        return self.state === EState.STARTING;
      },
      isActive: (): boolean => {
        return self.state === EState.ACTIVE;
      },
      isStopping: (): boolean => {
        return self.state === EState.STOPPING;
      },
      isFailed: (): boolean => {
        return self.state === EState.FAILED;
      },
    };
  })
  .views((self) => {
    return {
      get lastError(): TPresentationContextMap[EState]['lastError'] {
        return self.context.lastError;
      },
    };
  });

export type TPresentationStatusInstance = Instance<typeof PresentationStatusModel>;

export const INITIAL_PRESENTATION_STATUS_SNAPSHOT = {
  state: EState.IDLE,
  context: {},
} as SnapshotIn<typeof PresentationStatusModel>;
