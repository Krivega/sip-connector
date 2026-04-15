import { types } from 'mobx-state-tree';

import { EPresentationStatus, sessionSelectors } from '@/index';
import { createStatusStateModel } from '../createStatusStateModel';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TSessionSnapshot, TPresentationContextMap } from '@/index';
import type { TStatusSnapshot, TStatusSnapshotByState } from '../statusSnapshot';

type TPresentationStatusSnapshotByState<TState extends EPresentationStatus> =
  TStatusSnapshotByState<TState, TPresentationContextMap>;

export type TPresentationStatusSnapshot = TStatusSnapshot<
  EPresentationStatus,
  TPresentationContextMap
>;

const withStatusSnapshotViews = <TState extends EPresentationStatus>(
  base: ReturnType<typeof createStatusStateModel<TState, TPresentationContextMap[TState]>>,
) => {
  return base
    .views((self) => {
      return {
        get snapshot(): TPresentationStatusSnapshotByState<TState> {
          return { state: self.state, context: self.context };
        },
      };
    })
    .views((self) => {
      return {
        isIdle: (): boolean => {
          return self.snapshot.state === EPresentationStatus.IDLE;
        },
        isStarting: (): boolean => {
          return self.snapshot.state === EPresentationStatus.STARTING;
        },
        isActive: (): boolean => {
          return self.snapshot.state === EPresentationStatus.ACTIVE;
        },
        isStopping: (): boolean => {
          return self.snapshot.state === EPresentationStatus.STOPPING;
        },
        isFailed: (): boolean => {
          return self.snapshot.state === EPresentationStatus.FAILED;
        },
      };
    })
    .views((self) => {
      return {
        get lastError(): TPresentationContextMap[TState]['lastError'] {
          return self.context.lastError;
        },
      };
    });
};

export function createPresentationStatusSnapshotFromSession(
  snapshot: TSessionSnapshot,
): TPresentationStatusSnapshot {
  const state = sessionSelectors.selectPresentationStatus(snapshot);
  const {
    presentation: { context },
  } = snapshot;

  return {
    state,
    context,
  } as TPresentationStatusSnapshot;
}

const PresentationIdleStatusModel = withStatusSnapshotViews(
  createStatusStateModel<
    EPresentationStatus.IDLE,
    TPresentationContextMap[EPresentationStatus.IDLE]
  >(EPresentationStatus.IDLE),
);
const PresentationStartingStatusModel = withStatusSnapshotViews(
  createStatusStateModel<
    EPresentationStatus.STARTING,
    TPresentationContextMap[EPresentationStatus.STARTING]
  >(EPresentationStatus.STARTING),
);
const PresentationActiveStatusModel = withStatusSnapshotViews(
  createStatusStateModel<
    EPresentationStatus.ACTIVE,
    TPresentationContextMap[EPresentationStatus.ACTIVE]
  >(EPresentationStatus.ACTIVE),
);
const PresentationStoppingStatusModel = withStatusSnapshotViews(
  createStatusStateModel<
    EPresentationStatus.STOPPING,
    TPresentationContextMap[EPresentationStatus.STOPPING]
  >(EPresentationStatus.STOPPING),
);
const PresentationFailedStatusModel = withStatusSnapshotViews(
  createStatusStateModel<
    EPresentationStatus.FAILED,
    TPresentationContextMap[EPresentationStatus.FAILED]
  >(EPresentationStatus.FAILED),
);

export const PresentationStatusModel = types.union(
  PresentationIdleStatusModel,
  PresentationStartingStatusModel,
  PresentationActiveStatusModel,
  PresentationStoppingStatusModel,
  PresentationFailedStatusModel,
);

export type TPresentationStatusInstance = Instance<typeof PresentationStatusModel>;

export const INITIAL_PRESENTATION_STATUS_SNAPSHOT = {
  state: EPresentationStatus.IDLE,
  context: {},
} as SnapshotIn<typeof PresentationStatusModel>;
