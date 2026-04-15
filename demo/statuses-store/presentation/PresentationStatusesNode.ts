import { types } from 'mobx-state-tree';

import { EPresentationStatus, sessionSelectors } from '@/index';
import { createNodeModel } from '../createNodeModel';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TSessionSnapshot } from '@/index';
import type { TPresentationContextMap } from '@/PresentationManager/PresentationStateMachine';

type TPresentationNodeByState<TState extends EPresentationStatus> = {
  state: TState;
  context: TPresentationContextMap[TState];
};

export type TPresentationNodeValue = {
  [TState in EPresentationStatus]: TPresentationNodeByState<TState>;
}[EPresentationStatus];

const withNodeValueViews = <TState extends EPresentationStatus>(
  base: ReturnType<typeof createNodeModel<TState, TPresentationContextMap[TState]>>,
) => {
  return base
    .views((self) => {
      return {
        get nodeValue(): TPresentationNodeByState<TState> {
          return { state: self.state, context: self.context };
        },
      };
    })
    .views((self) => {
      return {
        hasIdle: (): boolean => {
          return self.nodeValue.state === EPresentationStatus.IDLE;
        },
        hasStarting: (): boolean => {
          return self.nodeValue.state === EPresentationStatus.STARTING;
        },
        hasActive: (): boolean => {
          return self.nodeValue.state === EPresentationStatus.ACTIVE;
        },
        hasStopping: (): boolean => {
          return self.nodeValue.state === EPresentationStatus.STOPPING;
        },
        hasFailed: (): boolean => {
          return self.nodeValue.state === EPresentationStatus.FAILED;
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

export function buildPresentationNodeFromSession(
  snapshot: TSessionSnapshot,
): TPresentationNodeValue {
  const state = sessionSelectors.selectPresentationStatus(snapshot);
  const {
    presentation: { context },
  } = snapshot;

  switch (state) {
    case EPresentationStatus.IDLE: {
      return { state, context: context as TPresentationContextMap[EPresentationStatus.IDLE] };
    }
    case EPresentationStatus.STARTING: {
      return { state, context: context as TPresentationContextMap[EPresentationStatus.STARTING] };
    }
    case EPresentationStatus.ACTIVE: {
      return { state, context: context as TPresentationContextMap[EPresentationStatus.ACTIVE] };
    }
    case EPresentationStatus.STOPPING: {
      return { state, context: context as TPresentationContextMap[EPresentationStatus.STOPPING] };
    }
    case EPresentationStatus.FAILED: {
      return { state, context: context as TPresentationContextMap[EPresentationStatus.FAILED] };
    }
    default: {
      throw new Error('Unsupported presentation status');
    }
  }
}

const PresentationIdleNodeModel = withNodeValueViews(
  createNodeModel<EPresentationStatus.IDLE, TPresentationContextMap[EPresentationStatus.IDLE]>(
    EPresentationStatus.IDLE,
  ),
);
const PresentationStartingNodeModel = withNodeValueViews(
  createNodeModel<
    EPresentationStatus.STARTING,
    TPresentationContextMap[EPresentationStatus.STARTING]
  >(EPresentationStatus.STARTING),
);
const PresentationActiveNodeModel = withNodeValueViews(
  createNodeModel<EPresentationStatus.ACTIVE, TPresentationContextMap[EPresentationStatus.ACTIVE]>(
    EPresentationStatus.ACTIVE,
  ),
);
const PresentationStoppingNodeModel = withNodeValueViews(
  createNodeModel<
    EPresentationStatus.STOPPING,
    TPresentationContextMap[EPresentationStatus.STOPPING]
  >(EPresentationStatus.STOPPING),
);
const PresentationFailedNodeModel = withNodeValueViews(
  createNodeModel<EPresentationStatus.FAILED, TPresentationContextMap[EPresentationStatus.FAILED]>(
    EPresentationStatus.FAILED,
  ),
);

export const PresentationNodeModel = types.union(
  PresentationIdleNodeModel,
  PresentationStartingNodeModel,
  PresentationActiveNodeModel,
  PresentationStoppingNodeModel,
  PresentationFailedNodeModel,
);

export type TPresentationNodeInstance = Instance<typeof PresentationNodeModel>;

export const INITIAL_PRESENTATION_NODE_SNAPSHOT = {
  state: EPresentationStatus.IDLE,
  context: {},
} as SnapshotIn<typeof PresentationNodeModel>;
