import { types } from 'mobx-state-tree';

import { EAutoConnectorState as EAutoConnectorStatus } from '@/AutoConnectorManager/AutoConnectorStateMachine';
import { createNodeModel } from '../createNodeModel';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TParametersAutoConnect } from '@/AutoConnectorManager/types';
import type { TSessionSnapshot } from '@/index';

export type TAutoConnectorStopReason = 'halted' | 'cancelled' | 'failed';

export type TAutoConnectorNodeValue =
  | {
      state: EAutoConnectorStatus.IDLE;
      context: {
        stopReason?: TAutoConnectorStopReason;
        lastError?: unknown;
      };
    }
  | {
      state: EAutoConnectorStatus.DISCONNECTING;
      context: {
        afterDisconnect: 'attempt' | 'idle';
        parameters?: TParametersAutoConnect;
        stopReason?: TAutoConnectorStopReason;
        lastError?: unknown;
      };
    }
  | {
      state:
        | EAutoConnectorStatus.ATTEMPTING_GATE
        | EAutoConnectorStatus.ATTEMPTING_CONNECT
        | EAutoConnectorStatus.WAITING_BEFORE_RETRY
        | EAutoConnectorStatus.CONNECTED_MONITORING
        | EAutoConnectorStatus.TELEPHONY_CHECKING;
      context: {
        parameters?: TParametersAutoConnect;
        lastError?: unknown;
      };
    }
  | {
      state: EAutoConnectorStatus.ERROR_TERMINAL;
      context: {
        parameters?: TParametersAutoConnect;
        stopReason?: TAutoConnectorStopReason;
        lastError?: unknown;
      };
    };

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
  const { parameters, afterDisconnect, stopReason, lastError } = snapshot.autoConnector.context;

  if (state === EAutoConnectorStatus.IDLE) {
    return {
      state,
      context: {
        stopReason: stopReason as TAutoConnectorStopReason | undefined,
        lastError,
      },
    };
  }

  if (state === EAutoConnectorStatus.DISCONNECTING) {
    return {
      state,
      context: {
        afterDisconnect,
        parameters,
        stopReason: stopReason as TAutoConnectorStopReason | undefined,
        lastError,
      },
    };
  }

  if (
    state === EAutoConnectorStatus.ATTEMPTING_GATE ||
    state === EAutoConnectorStatus.ATTEMPTING_CONNECT ||
    state === EAutoConnectorStatus.WAITING_BEFORE_RETRY ||
    state === EAutoConnectorStatus.CONNECTED_MONITORING ||
    state === EAutoConnectorStatus.TELEPHONY_CHECKING
  ) {
    return {
      state,
      context: {
        parameters,
        lastError,
      },
    };
  }

  return {
    state: EAutoConnectorStatus.ERROR_TERMINAL,
    context: {
      parameters,
      stopReason: stopReason as TAutoConnectorStopReason | undefined,
      lastError,
    },
  };
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
