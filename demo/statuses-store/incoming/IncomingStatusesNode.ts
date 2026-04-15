import { types } from 'mobx-state-tree';

import { EIncomingStatus, sessionSelectors } from '@/index';
import { createNodeModel } from '../createNodeModel';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TIncomingContextMap } from '@/IncomingCallManager/IncomingCallStateMachine';
import type { TSessionSnapshot } from '@/index';

type TIncomingNodeByState<TState extends EIncomingStatus> = {
  state: TState;
  context: TIncomingContextMap[TState];
};

export type TIncomingNodeValue = {
  [TState in EIncomingStatus]: TIncomingNodeByState<TState>;
}[EIncomingStatus];

const withNodeValueViews = <TState extends EIncomingStatus>(
  base: ReturnType<typeof createNodeModel<TState, TIncomingContextMap[TState]>>,
) => {
  return base
    .views((self) => {
      return {
        get nodeValue(): TIncomingNodeByState<TState> {
          return { state: self.state, context: self.context };
        },
      };
    })
    .views((self) => {
      return {
        hasIdle: (): boolean => {
          return self.nodeValue.state === EIncomingStatus.IDLE;
        },
        hasRinging: (): boolean => {
          return self.nodeValue.state === EIncomingStatus.RINGING;
        },
        hasConsumed: (): boolean => {
          return self.nodeValue.state === EIncomingStatus.CONSUMED;
        },
        hasDeclined: (): boolean => {
          return self.nodeValue.state === EIncomingStatus.DECLINED;
        },
        hasTerminated: (): boolean => {
          return self.nodeValue.state === EIncomingStatus.TERMINATED;
        },
        hasFailed: (): boolean => {
          return self.nodeValue.state === EIncomingStatus.FAILED;
        },
      };
    })
    .views((self) => {
      return {
        get remoteCallerData(): TIncomingContextMap[TState]['remoteCallerData'] {
          return self.context.remoteCallerData;
        },
        get lastReason(): TIncomingContextMap[TState]['lastReason'] {
          return self.context.lastReason;
        },
      };
    });
};

export function buildIncomingNodeFromSession(snapshot: TSessionSnapshot): TIncomingNodeValue {
  const state = sessionSelectors.selectIncomingStatus(snapshot);
  const {
    incoming: { context },
  } = snapshot;

  return {
    state,
    context,
  } as TIncomingNodeValue;
}

const IncomingIdleNodeModel = withNodeValueViews(
  createNodeModel<EIncomingStatus.IDLE, TIncomingContextMap[EIncomingStatus.IDLE]>(
    EIncomingStatus.IDLE,
  ),
);
const IncomingRingingNodeModel = withNodeValueViews(
  createNodeModel<EIncomingStatus.RINGING, TIncomingContextMap[EIncomingStatus.RINGING]>(
    EIncomingStatus.RINGING,
  ),
);
const IncomingConsumedNodeModel = withNodeValueViews(
  createNodeModel<EIncomingStatus.CONSUMED, TIncomingContextMap[EIncomingStatus.CONSUMED]>(
    EIncomingStatus.CONSUMED,
  ),
);
const IncomingDeclinedNodeModel = withNodeValueViews(
  createNodeModel<EIncomingStatus.DECLINED, TIncomingContextMap[EIncomingStatus.DECLINED]>(
    EIncomingStatus.DECLINED,
  ),
);
const IncomingTerminatedNodeModel = withNodeValueViews(
  createNodeModel<EIncomingStatus.TERMINATED, TIncomingContextMap[EIncomingStatus.TERMINATED]>(
    EIncomingStatus.TERMINATED,
  ),
);
const IncomingFailedNodeModel = withNodeValueViews(
  createNodeModel<EIncomingStatus.FAILED, TIncomingContextMap[EIncomingStatus.FAILED]>(
    EIncomingStatus.FAILED,
  ),
);

export const IncomingNodeModel = types.union(
  IncomingIdleNodeModel,
  IncomingRingingNodeModel,
  IncomingConsumedNodeModel,
  IncomingDeclinedNodeModel,
  IncomingTerminatedNodeModel,
  IncomingFailedNodeModel,
);

export type TIncomingNodeInstance = Instance<typeof IncomingNodeModel>;

export const INITIAL_INCOMING_NODE_SNAPSHOT = {
  state: EIncomingStatus.IDLE,
  context: {},
} as SnapshotIn<typeof IncomingNodeModel>;
