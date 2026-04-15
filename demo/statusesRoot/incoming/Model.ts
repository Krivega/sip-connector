import { types } from 'mobx-state-tree';

import { EIncomingStatus, sessionSelectors } from '@/index';
import { createStatusStateModel } from '../createStatusStateModel';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TIncomingContextMap } from '@/IncomingCallManager/IncomingCallStateMachine';
import type { TSessionSnapshot } from '@/index';
import type { TStatusSnapshot, TStatusSnapshotByState } from '../statusSnapshot';

type TIncomingStatusSnapshotByState<TState extends EIncomingStatus> = TStatusSnapshotByState<
  TState,
  TIncomingContextMap
>;

export type TIncomingStatusSnapshot = TStatusSnapshot<EIncomingStatus, TIncomingContextMap>;

const withStatusSnapshotViews = <TState extends EIncomingStatus>(
  base: ReturnType<typeof createStatusStateModel<TState, TIncomingContextMap[TState]>>,
) => {
  return base
    .views((self) => {
      return {
        get snapshot(): TIncomingStatusSnapshotByState<TState> {
          return { state: self.state, context: self.context };
        },
      };
    })
    .views((self) => {
      return {
        isIdle: (): boolean => {
          return self.snapshot.state === EIncomingStatus.IDLE;
        },
        isRinging: (): boolean => {
          return self.snapshot.state === EIncomingStatus.RINGING;
        },
        isConsumed: (): boolean => {
          return self.snapshot.state === EIncomingStatus.CONSUMED;
        },
        isDeclined: (): boolean => {
          return self.snapshot.state === EIncomingStatus.DECLINED;
        },
        isTerminated: (): boolean => {
          return self.snapshot.state === EIncomingStatus.TERMINATED;
        },
        isFailed: (): boolean => {
          return self.snapshot.state === EIncomingStatus.FAILED;
        },
      };
    })
    .views((self) => {
      return {
        get remoteCallerData(): TIncomingContextMap[TState]['remoteCallerData'] {
          return self.context.remoteCallerData;
        },
        get terminalReason(): TIncomingContextMap[TState]['lastReason'] {
          return self.context.lastReason;
        },
      };
    });
};

export function createIncomingStatusSnapshotFromSession(
  snapshot: TSessionSnapshot,
): TIncomingStatusSnapshot {
  const state = sessionSelectors.selectIncomingStatus(snapshot);
  const {
    incoming: { context },
  } = snapshot;

  return {
    state,
    context,
  } as TIncomingStatusSnapshot;
}

const IncomingIdleStatusModel = withStatusSnapshotViews(
  createStatusStateModel<EIncomingStatus.IDLE, TIncomingContextMap[EIncomingStatus.IDLE]>(
    EIncomingStatus.IDLE,
  ),
);
const IncomingRingingStatusModel = withStatusSnapshotViews(
  createStatusStateModel<EIncomingStatus.RINGING, TIncomingContextMap[EIncomingStatus.RINGING]>(
    EIncomingStatus.RINGING,
  ),
);
const IncomingConsumedStatusModel = withStatusSnapshotViews(
  createStatusStateModel<EIncomingStatus.CONSUMED, TIncomingContextMap[EIncomingStatus.CONSUMED]>(
    EIncomingStatus.CONSUMED,
  ),
);
const IncomingDeclinedStatusModel = withStatusSnapshotViews(
  createStatusStateModel<EIncomingStatus.DECLINED, TIncomingContextMap[EIncomingStatus.DECLINED]>(
    EIncomingStatus.DECLINED,
  ),
);
const IncomingTerminatedStatusModel = withStatusSnapshotViews(
  createStatusStateModel<
    EIncomingStatus.TERMINATED,
    TIncomingContextMap[EIncomingStatus.TERMINATED]
  >(EIncomingStatus.TERMINATED),
);
const IncomingFailedStatusModel = withStatusSnapshotViews(
  createStatusStateModel<EIncomingStatus.FAILED, TIncomingContextMap[EIncomingStatus.FAILED]>(
    EIncomingStatus.FAILED,
  ),
);

export const IncomingStatusModel = types.union(
  IncomingIdleStatusModel,
  IncomingRingingStatusModel,
  IncomingConsumedStatusModel,
  IncomingDeclinedStatusModel,
  IncomingTerminatedStatusModel,
  IncomingFailedStatusModel,
);

export type TIncomingStatusInstance = Instance<typeof IncomingStatusModel>;

export const INITIAL_INCOMING_STATUS_SNAPSHOT = {
  state: EIncomingStatus.IDLE,
  context: {},
} as SnapshotIn<typeof IncomingStatusModel>;
