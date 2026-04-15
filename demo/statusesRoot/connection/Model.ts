import { types } from 'mobx-state-tree';

import { EConnectionStatus, sessionSelectors } from '@/index';
import { createStatusStateModel } from '../createStatusStateModel';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TConnectionContextMap, TSessionSnapshot } from '@/index';
import type { TStatusSnapshot, TStatusSnapshotByState } from '../statusSnapshot';

type TConnectionStatusSnapshotByState<TState extends EConnectionStatus> = TStatusSnapshotByState<
  TState,
  TConnectionContextMap
>;

export type TConnectionStatusSnapshot = TStatusSnapshot<EConnectionStatus, TConnectionContextMap>;

const withStatusSnapshotViews = <TState extends EConnectionStatus>(
  base: ReturnType<typeof createStatusStateModel<TState, TConnectionContextMap[TState]>>,
) => {
  return base
    .views((self) => {
      return {
        get snapshot(): TConnectionStatusSnapshotByState<TState> {
          return { state: self.state, context: self.context };
        },
      };
    })
    .views((self) => {
      return {
        isIdle: (): boolean => {
          return self.snapshot.state === EConnectionStatus.IDLE;
        },
        isPreparing: (): boolean => {
          return self.snapshot.state === EConnectionStatus.PREPARING;
        },
        isConnecting: (): boolean => {
          return self.snapshot.state === EConnectionStatus.CONNECTING;
        },
        isConnected: (): boolean => {
          return self.snapshot.state === EConnectionStatus.CONNECTED;
        },
        isRegistered: (): boolean => {
          return self.snapshot.state === EConnectionStatus.REGISTERED;
        },
        isEstablished: (): boolean => {
          return self.snapshot.state === EConnectionStatus.ESTABLISHED;
        },
        isDisconnecting: (): boolean => {
          return self.snapshot.state === EConnectionStatus.DISCONNECTING;
        },
        isDisconnected: (): boolean => {
          return self.snapshot.state === EConnectionStatus.DISCONNECTED;
        },
      };
    })
    .views((self) => {
      return {
        get connectionConfig(): TConnectionContextMap[TState]['connectionConfiguration'] {
          return self.context.connectionConfiguration;
        },
      };
    });
};

export function createConnectionStatusSnapshotFromSession(
  snapshot: TSessionSnapshot,
): TConnectionStatusSnapshot {
  const state = sessionSelectors.selectConnectionStatus(snapshot);
  const {
    connection: { context },
  } = snapshot;

  return {
    state,
    context,
  } as TConnectionStatusSnapshot;
}

const ConnectionIdleStatusModel = withStatusSnapshotViews(
  createStatusStateModel<EConnectionStatus.IDLE, TConnectionContextMap[EConnectionStatus.IDLE]>(
    EConnectionStatus.IDLE,
  ),
);
const ConnectionPreparingStatusModel = withStatusSnapshotViews(
  createStatusStateModel<
    EConnectionStatus.PREPARING,
    TConnectionContextMap[EConnectionStatus.PREPARING]
  >(EConnectionStatus.PREPARING),
);
const ConnectionConnectingStatusModel = withStatusSnapshotViews(
  createStatusStateModel<
    EConnectionStatus.CONNECTING,
    TConnectionContextMap[EConnectionStatus.CONNECTING]
  >(EConnectionStatus.CONNECTING),
);
const ConnectionConnectedStatusModel = withStatusSnapshotViews(
  createStatusStateModel<
    EConnectionStatus.CONNECTED,
    TConnectionContextMap[EConnectionStatus.CONNECTED]
  >(EConnectionStatus.CONNECTED),
);
const ConnectionRegisteredStatusModel = withStatusSnapshotViews(
  createStatusStateModel<
    EConnectionStatus.REGISTERED,
    TConnectionContextMap[EConnectionStatus.REGISTERED]
  >(EConnectionStatus.REGISTERED),
);
const ConnectionEstablishedStatusModel = withStatusSnapshotViews(
  createStatusStateModel<
    EConnectionStatus.ESTABLISHED,
    TConnectionContextMap[EConnectionStatus.ESTABLISHED]
  >(EConnectionStatus.ESTABLISHED),
);
const ConnectionDisconnectingStatusModel = withStatusSnapshotViews(
  createStatusStateModel<
    EConnectionStatus.DISCONNECTING,
    TConnectionContextMap[EConnectionStatus.DISCONNECTING]
  >(EConnectionStatus.DISCONNECTING),
);
const ConnectionDisconnectedStatusModel = withStatusSnapshotViews(
  createStatusStateModel<
    EConnectionStatus.DISCONNECTED,
    TConnectionContextMap[EConnectionStatus.DISCONNECTED]
  >(EConnectionStatus.DISCONNECTED),
);

export const ConnectionStatusModel = types.union(
  ConnectionIdleStatusModel,
  ConnectionPreparingStatusModel,
  ConnectionConnectingStatusModel,
  ConnectionConnectedStatusModel,
  ConnectionRegisteredStatusModel,
  ConnectionEstablishedStatusModel,
  ConnectionDisconnectingStatusModel,
  ConnectionDisconnectedStatusModel,
);

export type TConnectionStatusInstance = Instance<typeof ConnectionStatusModel>;

export const INITIAL_CONNECTION_STATUS_SNAPSHOT = {
  state: EConnectionStatus.IDLE,
  context: {},
} as SnapshotIn<typeof ConnectionStatusModel>;
