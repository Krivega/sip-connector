import { types } from 'mobx-state-tree';

import { EPresentationStatus, sessionSelectors } from '@/index';
import { createNodeModel } from '../createNodeModel';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TSessionSnapshot } from '@/index';

export type TPresentationNodeValue =
  | { state: EPresentationStatus.IDLE; context: Record<string, never> }
  | { state: EPresentationStatus.STARTING; context: Record<string, never> }
  | { state: EPresentationStatus.ACTIVE; context: Record<string, never> }
  | { state: EPresentationStatus.STOPPING; context: Record<string, never> }
  | { state: EPresentationStatus.FAILED; context: { lastError?: unknown } };

const withNodeValueViews = <S extends string, C>(
  base: ReturnType<typeof createNodeModel<S, C>>,
) => {
  return base.views((self) => {
    return {
      get nodeValue(): TPresentationNodeValue {
        return { state: self.state, context: self.context } as TPresentationNodeValue;
      },
    };
  });
};

export function buildPresentationNodeFromSession(
  snapshot: TSessionSnapshot,
): TPresentationNodeValue {
  const state = sessionSelectors.selectPresentationStatus(snapshot);

  if (state === EPresentationStatus.FAILED) {
    return {
      state,
      context: {
        lastError: snapshot.presentation.context.lastError,
      },
    };
  }

  return {
    state,
    context: {},
  };
}

const PresentationIdleNodeModel = withNodeValueViews(
  createNodeModel<EPresentationStatus.IDLE, Record<string, never>>(EPresentationStatus.IDLE),
);
const PresentationStartingNodeModel = withNodeValueViews(
  createNodeModel<EPresentationStatus.STARTING, Record<string, never>>(
    EPresentationStatus.STARTING,
  ),
);
const PresentationActiveNodeModel = withNodeValueViews(
  createNodeModel<EPresentationStatus.ACTIVE, Record<string, never>>(EPresentationStatus.ACTIVE),
);
const PresentationStoppingNodeModel = withNodeValueViews(
  createNodeModel<EPresentationStatus.STOPPING, Record<string, never>>(
    EPresentationStatus.STOPPING,
  ),
);
const PresentationFailedNodeModel = withNodeValueViews(
  createNodeModel<EPresentationStatus.FAILED, { lastError?: unknown }>(EPresentationStatus.FAILED),
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
