import { types } from 'mobx-state-tree';

import { EIncomingStatus as EState, sessionSelectors } from '@/index';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TIncomingContextMap, TSessionSnapshot } from '@/index';

type TSnapshotByState<TState extends EState> = {
  state: TState;
  context: TIncomingContextMap[TState];
};

export type TIncomingStatusSnapshot = TSnapshotByState<EState>;

export const createIncomingStatusSnapshotFromSession = (
  snapshot: TSessionSnapshot,
): TSnapshotByState<EState> => {
  const state = sessionSelectors.selectIncomingStatus(snapshot);
  const {
    incoming: { context },
  } = snapshot;

  return {
    state,
    context,
  } as TIncomingStatusSnapshot;
};

export const IncomingStatusModel = types
  .model({
    state: types.enumeration('IncomingStatus', [
      EState.IDLE,
      EState.RINGING,
      EState.CONSUMED,
      EState.DECLINED,
      EState.TERMINATED,
      EState.FAILED,
    ]),
    context: types.frozen<TIncomingContextMap[EState]>(),
  })
  .views((self) => {
    return {
      get snapshot(): TSnapshotByState<EState> {
        return {
          state: self.state,
          context: self.context,
        } as TIncomingStatusSnapshot;
      },
    };
  })
  .views((self) => {
    const hasState = (state: EState): boolean => {
      return self.state === state;
    };

    return {
      isIdle: (): boolean => {
        return hasState(EState.IDLE);
      },
      isRinging: (): boolean => {
        return hasState(EState.RINGING);
      },
      isConsumed: (): boolean => {
        return hasState(EState.CONSUMED);
      },
      isDeclined: (): boolean => {
        return hasState(EState.DECLINED);
      },
      isTerminated: (): boolean => {
        return hasState(EState.TERMINATED);
      },
      isFailed: (): boolean => {
        return hasState(EState.FAILED);
      },
    };
  })
  .views((self) => {
    return {
      get remoteCallerData(): TIncomingContextMap[EState]['remoteCallerData'] {
        return self.context.remoteCallerData;
      },
      get terminalReason(): TIncomingContextMap[EState]['lastReason'] {
        return self.context.lastReason;
      },
      get incomingNumber(): string | undefined {
        return self.context.remoteCallerData?.incomingNumber;
      },
      get displayName(): string | undefined {
        return self.context.remoteCallerData?.displayName;
      },
    };
  });

export type TIncomingStatusInstance = Instance<typeof IncomingStatusModel>;

export const INITIAL_INCOMING_STATUS_SNAPSHOT = {
  state: EState.IDLE,
  context: {},
} as SnapshotIn<typeof IncomingStatusModel>;
