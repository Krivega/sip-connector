import { types } from 'mobx-state-tree';

import { EAutoConnectorStatus } from '@/index';
import { createStatusStateModel } from '../createStatusStateModel';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TAutoConnectorContextMap, TParametersAutoConnect, TSessionSnapshot } from '@/index';
import type { TStatusSnapshot } from '../statusSnapshot';

export type TAutoConnectorStopReason = 'halted' | 'cancelled' | 'failed';

export type TAutoConnectorStatusSnapshot = TStatusSnapshot<
  EAutoConnectorStatus,
  TAutoConnectorContextMap
>;

const withStatusSnapshotViews = <S extends string, C>(
  base: ReturnType<typeof createStatusStateModel<S, C>>,
) => {
  return base.views((self) => {
    return {
      get snapshot(): TAutoConnectorStatusSnapshot {
        return { state: self.state, context: self.context } as TAutoConnectorStatusSnapshot;
      },
    };
  });
};

export function createAutoConnectorStatusSnapshotFromSession(
  snapshot: TSessionSnapshot,
): TAutoConnectorStatusSnapshot {
  const state = snapshot.autoConnector.value;
  const { context } = snapshot.autoConnector;

  return {
    state,
    context,
  } as TAutoConnectorStatusSnapshot;
}

const AutoConnectorIdleStatusModel = withStatusSnapshotViews(
  createStatusStateModel<
    EAutoConnectorStatus.IDLE,
    {
      stopReason?: TAutoConnectorStopReason;
      lastError?: unknown;
    }
  >(EAutoConnectorStatus.IDLE),
);
const AutoConnectorDisconnectingStatusModel = withStatusSnapshotViews(
  createStatusStateModel<
    EAutoConnectorStatus.DISCONNECTING,
    {
      afterDisconnect: 'attempt' | 'idle';
      parameters?: TParametersAutoConnect;
      stopReason?: TAutoConnectorStopReason;
      lastError?: unknown;
    }
  >(EAutoConnectorStatus.DISCONNECTING),
);
const AutoConnectorAttemptingGateStatusModel = withStatusSnapshotViews(
  createStatusStateModel<
    EAutoConnectorStatus.ATTEMPTING_GATE,
    {
      parameters?: TParametersAutoConnect;
      lastError?: unknown;
    }
  >(EAutoConnectorStatus.ATTEMPTING_GATE),
);
const AutoConnectorAttemptingConnectStatusModel = withStatusSnapshotViews(
  createStatusStateModel<
    EAutoConnectorStatus.ATTEMPTING_CONNECT,
    {
      parameters?: TParametersAutoConnect;
      lastError?: unknown;
    }
  >(EAutoConnectorStatus.ATTEMPTING_CONNECT),
);
const AutoConnectorWaitingBeforeRetryStatusModel = withStatusSnapshotViews(
  createStatusStateModel<
    EAutoConnectorStatus.WAITING_BEFORE_RETRY,
    {
      parameters?: TParametersAutoConnect;
      lastError?: unknown;
    }
  >(EAutoConnectorStatus.WAITING_BEFORE_RETRY),
);
const AutoConnectorConnectedMonitoringStatusModel = withStatusSnapshotViews(
  createStatusStateModel<
    EAutoConnectorStatus.CONNECTED_MONITORING,
    {
      parameters?: TParametersAutoConnect;
      lastError?: unknown;
    }
  >(EAutoConnectorStatus.CONNECTED_MONITORING),
);
const AutoConnectorTelephonyCheckingStatusModel = withStatusSnapshotViews(
  createStatusStateModel<
    EAutoConnectorStatus.TELEPHONY_CHECKING,
    {
      parameters?: TParametersAutoConnect;
      lastError?: unknown;
    }
  >(EAutoConnectorStatus.TELEPHONY_CHECKING),
);
const AutoConnectorErrorTerminalStatusModel = withStatusSnapshotViews(
  createStatusStateModel<
    EAutoConnectorStatus.ERROR_TERMINAL,
    {
      parameters?: TParametersAutoConnect;
      stopReason?: TAutoConnectorStopReason;
      lastError?: unknown;
    }
  >(EAutoConnectorStatus.ERROR_TERMINAL),
);

export const AutoConnectorStatusModel = types.union(
  AutoConnectorIdleStatusModel,
  AutoConnectorDisconnectingStatusModel,
  AutoConnectorAttemptingGateStatusModel,
  AutoConnectorAttemptingConnectStatusModel,
  AutoConnectorWaitingBeforeRetryStatusModel,
  AutoConnectorConnectedMonitoringStatusModel,
  AutoConnectorTelephonyCheckingStatusModel,
  AutoConnectorErrorTerminalStatusModel,
);

export type TAutoConnectorStatusInstance = Instance<typeof AutoConnectorStatusModel>;

export const INITIAL_AUTO_CONNECTOR_STATUS_SNAPSHOT = {
  state: EAutoConnectorStatus.IDLE,
  context: {},
} as SnapshotIn<typeof AutoConnectorStatusModel>;
