import { types } from 'mobx-state-tree';

import { EIncomingStatus as EState, sessionSelectors } from '@/index';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type {
  TIncomingSnapshot as TSnapshot,
  TIncomingContextMap,
  TSessionSnapshot,
} from '@/index';

type TSnapshotByState<TState extends EState> = TState extends EState
  ? Extract<TSnapshot, { value: TState }> extends { context: infer TContext }
    ? { state: TState; context: TContext }
    : never
  : never;

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
    return {
      isIdle: (): boolean => {
        return self.state === EState.IDLE;
      },
      isRinging: (): boolean => {
        return self.state === EState.RINGING;
      },
      isConsumed: (): boolean => {
        return self.state === EState.CONSUMED;
      },
      isDeclined: (): boolean => {
        return self.state === EState.DECLINED;
      },
      isTerminated: (): boolean => {
        return self.state === EState.TERMINATED;
      },
      isFailed: (): boolean => {
        return self.state === EState.FAILED;
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
