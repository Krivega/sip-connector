import { types } from 'mobx-state-tree';

import { EAutoConnectorState as EAutoConnectorStatus } from '@/AutoConnectorManager/AutoConnectorStateMachine';
import { createNodeModel } from '../createNodeModel';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TAutoConnectorContextMap } from '@/AutoConnectorManager/AutoConnectorStateMachine';
import type { TParametersAutoConnect } from '@/AutoConnectorManager/types';
import type { TSessionSnapshot } from '@/index';
import type { TNodeValue } from '../nodeValue';

export type TAutoConnectorStopReason = 'halted' | 'cancelled' | 'failed';

export type TAutoConnectorNodeValue = TNodeValue<EAutoConnectorStatus, TAutoConnectorContextMap>;

const withNodeValueViews = <S extends string, C>(
  base: ReturnType<typeof createNodeModel<S, C>>,
) => {
  return base.views((self) => {
    return {
      get nodeValue(): TAutoConnectorNodeValue {
        return { state: self.state, context: self.context } as TAutoConnectorNodeValue;
      },
    };
  });
};

export function buildAutoConnectorNodeFromSession(
  snapshot: TSessionSnapshot,
): TAutoConnectorNodeValue {
  const state = snapshot.autoConnector.value;
  const { context } = snapshot.autoConnector;

  return {
    state,
    context,
  } as TAutoConnectorNodeValue;
}

const AutoConnectorIdleNodeModel = withNodeValueViews(
  createNodeModel<
    EAutoConnectorStatus.IDLE,
    {
      stopReason?: TAutoConnectorStopReason;
      lastError?: unknown;
    }
  >(EAutoConnectorStatus.IDLE),
);
const AutoConnectorDisconnectingNodeModel = withNodeValueViews(
  createNodeModel<
    EAutoConnectorStatus.DISCONNECTING,
    {
      afterDisconnect: 'attempt' | 'idle';
      parameters?: TParametersAutoConnect;
      stopReason?: TAutoConnectorStopReason;
      lastError?: unknown;
    }
  >(EAutoConnectorStatus.DISCONNECTING),
);
const AutoConnectorAttemptingGateNodeModel = withNodeValueViews(
  createNodeModel<
    EAutoConnectorStatus.ATTEMPTING_GATE,
    {
      parameters?: TParametersAutoConnect;
      lastError?: unknown;
    }
  >(EAutoConnectorStatus.ATTEMPTING_GATE),
);
const AutoConnectorAttemptingConnectNodeModel = withNodeValueViews(
  createNodeModel<
    EAutoConnectorStatus.ATTEMPTING_CONNECT,
    {
      parameters?: TParametersAutoConnect;
      lastError?: unknown;
    }
  >(EAutoConnectorStatus.ATTEMPTING_CONNECT),
);
const AutoConnectorWaitingBeforeRetryNodeModel = withNodeValueViews(
  createNodeModel<
    EAutoConnectorStatus.WAITING_BEFORE_RETRY,
    {
      parameters?: TParametersAutoConnect;
      lastError?: unknown;
    }
  >(EAutoConnectorStatus.WAITING_BEFORE_RETRY),
);
const AutoConnectorConnectedMonitoringNodeModel = withNodeValueViews(
  createNodeModel<
    EAutoConnectorStatus.CONNECTED_MONITORING,
    {
      parameters?: TParametersAutoConnect;
      lastError?: unknown;
    }
  >(EAutoConnectorStatus.CONNECTED_MONITORING),
);
const AutoConnectorTelephonyCheckingNodeModel = withNodeValueViews(
  createNodeModel<
    EAutoConnectorStatus.TELEPHONY_CHECKING,
    {
      parameters?: TParametersAutoConnect;
      lastError?: unknown;
    }
  >(EAutoConnectorStatus.TELEPHONY_CHECKING),
);
const AutoConnectorErrorTerminalNodeModel = withNodeValueViews(
  createNodeModel<
    EAutoConnectorStatus.ERROR_TERMINAL,
    {
      parameters?: TParametersAutoConnect;
      stopReason?: TAutoConnectorStopReason;
      lastError?: unknown;
    }
  >(EAutoConnectorStatus.ERROR_TERMINAL),
);

export const AutoConnectorNodeModel = types.union(
  AutoConnectorIdleNodeModel,
  AutoConnectorDisconnectingNodeModel,
  AutoConnectorAttemptingGateNodeModel,
  AutoConnectorAttemptingConnectNodeModel,
  AutoConnectorWaitingBeforeRetryNodeModel,
  AutoConnectorConnectedMonitoringNodeModel,
  AutoConnectorTelephonyCheckingNodeModel,
  AutoConnectorErrorTerminalNodeModel,
);

export type TAutoConnectorNodeInstance = Instance<typeof AutoConnectorNodeModel>;

export const INITIAL_AUTO_CONNECTOR_NODE_SNAPSHOT = {
  state: EAutoConnectorStatus.IDLE,
  context: {},
} as SnapshotIn<typeof AutoConnectorNodeModel>;
