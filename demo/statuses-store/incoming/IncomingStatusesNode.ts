import { types } from 'mobx-state-tree';

import { EIncomingStatus, sessionSelectors } from '@/index';
import { createNodeModel } from '../createNodeModel';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TRemoteCallerData } from '@/IncomingCallManager';
import type { TSessionSnapshot } from '@/index';

export type TIncomingNodeValue =
  | { state: EIncomingStatus.IDLE; context: Record<string, never> }
  | { state: EIncomingStatus.RINGING; context: { remoteCallerData: TRemoteCallerData } }
  | {
      state: EIncomingStatus.CONSUMED;
      context: {
        remoteCallerData?: TRemoteCallerData;
        lastReason: EIncomingStatus.CONSUMED;
      };
    }
  | {
      state: EIncomingStatus.DECLINED;
      context: {
        remoteCallerData?: TRemoteCallerData;
        lastReason: EIncomingStatus.DECLINED;
      };
    }
  | {
      state: EIncomingStatus.TERMINATED;
      context: {
        remoteCallerData?: TRemoteCallerData;
        lastReason: EIncomingStatus.TERMINATED;
      };
    }
  | {
      state: EIncomingStatus.FAILED;
      context: {
        remoteCallerData?: TRemoteCallerData;
        lastReason: EIncomingStatus.FAILED;
      };
    };

const withNodeValueViews = <S extends string, C>(
  base: ReturnType<typeof createNodeModel<S, C>>,
) => {
  return base.views((self) => {
    return {
      get nodeValue(): TIncomingNodeValue {
        return { state: self.state, context: self.context } as TIncomingNodeValue;
      },
    };
  });
};

export function buildIncomingNodeFromSession(snapshot: TSessionSnapshot): TIncomingNodeValue {
  const state = sessionSelectors.selectIncomingStatus(snapshot);
  const { remoteCallerData } = snapshot.incoming.context;

  if (state === EIncomingStatus.RINGING && remoteCallerData !== undefined) {
    return {
      state,
      context: {
        remoteCallerData,
      },
    };
  }

  if (
    state === EIncomingStatus.CONSUMED ||
    state === EIncomingStatus.DECLINED ||
    state === EIncomingStatus.TERMINATED ||
    state === EIncomingStatus.FAILED
  ) {
    if (state === EIncomingStatus.CONSUMED) {
      return {
        state,
        context: {
          remoteCallerData,
          lastReason: EIncomingStatus.CONSUMED,
        },
      };
    }

    if (state === EIncomingStatus.DECLINED) {
      return {
        state,
        context: {
          remoteCallerData,
          lastReason: EIncomingStatus.DECLINED,
        },
      };
    }

    if (state === EIncomingStatus.TERMINATED) {
      return {
        state,
        context: {
          remoteCallerData,
          lastReason: EIncomingStatus.TERMINATED,
        },
      };
    }

    return {
      state,
      context: {
        remoteCallerData,
        lastReason: EIncomingStatus.FAILED,
      },
    };
  }

  return {
    state: EIncomingStatus.IDLE,
    context: {},
  };
}

const IncomingIdleNodeModel = withNodeValueViews(
  createNodeModel<EIncomingStatus.IDLE, Record<string, never>>(EIncomingStatus.IDLE),
);
const IncomingRingingNodeModel = withNodeValueViews(
  createNodeModel<EIncomingStatus.RINGING, { remoteCallerData: TRemoteCallerData }>(
    EIncomingStatus.RINGING,
  ),
);
const IncomingConsumedNodeModel = withNodeValueViews(
  createNodeModel<
    EIncomingStatus.CONSUMED,
    {
      remoteCallerData?: TRemoteCallerData;
      lastReason: EIncomingStatus.CONSUMED;
    }
  >(EIncomingStatus.CONSUMED),
);
const IncomingDeclinedNodeModel = withNodeValueViews(
  createNodeModel<
    EIncomingStatus.DECLINED,
    {
      remoteCallerData?: TRemoteCallerData;
      lastReason: EIncomingStatus.DECLINED;
    }
  >(EIncomingStatus.DECLINED),
);
const IncomingTerminatedNodeModel = withNodeValueViews(
  createNodeModel<
    EIncomingStatus.TERMINATED,
    {
      remoteCallerData?: TRemoteCallerData;
      lastReason: EIncomingStatus.TERMINATED;
    }
  >(EIncomingStatus.TERMINATED),
);
const IncomingFailedNodeModel = withNodeValueViews(
  createNodeModel<
    EIncomingStatus.FAILED,
    {
      remoteCallerData?: TRemoteCallerData;
      lastReason: EIncomingStatus.FAILED;
    }
  >(EIncomingStatus.FAILED),
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
