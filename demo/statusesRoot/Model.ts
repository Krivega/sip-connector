import { applySnapshot, types } from 'mobx-state-tree';

import {
  AutoConnectorStatusModel,
  createAutoConnectorStatusSnapshotFromSession,
  INITIAL_AUTO_CONNECTOR_STATUS_SNAPSHOT,
} from './autoConnector/Model';
import {
  CallStatusModel,
  createCallStatusSnapshotFromSession,
  INITIAL_CALL_STATUS_SNAPSHOT,
} from './call/Model';
import {
  CallSessionStatusModel,
  createCallSessionStatusSnapshot,
  INITIAL_CALL_SESSION_STATUS_SNAPSHOT,
} from './callSession/Model';
import {
  ConnectionStatusModel,
  createConnectionStatusSnapshotFromSession,
  INITIAL_CONNECTION_STATUS_SNAPSHOT,
} from './connection/Model';
import {
  IncomingStatusModel,
  createIncomingStatusSnapshotFromSession,
  INITIAL_INCOMING_STATUS_SNAPSHOT,
} from './incoming/Model';
import {
  PresentationStatusModel,
  createPresentationStatusSnapshotFromSession,
  INITIAL_PRESENTATION_STATUS_SNAPSHOT,
} from './presentation/Model';
import {
  SystemStatusModel,
  createSystemStatusSnapshotFromSession,
  INITIAL_SYSTEM_STATUS_SNAPSHOT,
} from './system/Model';

import type { SnapshotIn, SnapshotOut } from 'mobx-state-tree';
import type {
  EAutoConnectorStatus,
  ECallStatus,
  EConnectionStatus,
  EIncomingStatus,
  EPresentationStatus,
  ESystemStatus,
  TCallSessionSnapshot,
  TSessionSnapshot,
} from '@/index';
import type { TAutoConnectorStatusSnapshot } from './autoConnector/Model';
import type { TCallStatusSnapshot } from './call/Model';
import type { TCallSessionStatusSnapshot } from './callSession/Model';
import type { TConnectionStatusSnapshot } from './connection/Model';
import type { TIncomingStatusSnapshot } from './incoming/Model';
import type { TPresentationStatusSnapshot } from './presentation/Model';
import type { TSystemStatusSnapshot } from './system/Model';

export type { TAutoConnectorStopReason, TAutoConnectorStatusSnapshot } from './autoConnector/Model';
export type { TCallStatusSnapshot } from './call/Model';
export type { TCallSessionStatusSnapshot } from './callSession/Model';
export type { TConnectionStatusSnapshot } from './connection/Model';
export type { TIncomingStatusSnapshot } from './incoming/Model';
export type { TPresentationStatusSnapshot } from './presentation/Model';
export type { TSystemStatusSnapshot } from './system/Model';

export type TStatusesRootSnapshot = {
  connection: TConnectionStatusSnapshot;
  autoConnector: TAutoConnectorStatusSnapshot;
  call: TCallStatusSnapshot;
  callSession: TCallSessionStatusSnapshot;
  incoming: TIncomingStatusSnapshot;
  presentation: TPresentationStatusSnapshot;
  system: SnapshotIn<typeof SystemStatusModel>;
};

export type TStatusesByDomain = {
  connection: EConnectionStatus;
  call: ECallStatus;
  incoming: EIncomingStatus;
  presentation: EPresentationStatus;
  system: ESystemStatus;
  autoConnector: EAutoConnectorStatus;
};

function createStatusesRootSnapshotFromSession(
  snapshot: TSessionSnapshot,
): Omit<SnapshotIn<typeof StatusesRootModel>, 'callSession'> {
  return {
    connection: createConnectionStatusSnapshotFromSession(snapshot),
    autoConnector: createAutoConnectorStatusSnapshotFromSession(snapshot),
    call: createCallStatusSnapshotFromSession(snapshot),
    incoming: createIncomingStatusSnapshotFromSession(snapshot),
    presentation: createPresentationStatusSnapshotFromSession(snapshot),
    system: createSystemStatusSnapshotFromSession(snapshot),
  };
}

export const StatusesRootModel = types
  .model({
    connection: ConnectionStatusModel,
    autoConnector: AutoConnectorStatusModel,
    call: CallStatusModel,
    callSession: CallSessionStatusModel,
    incoming: IncomingStatusModel,
    presentation: PresentationStatusModel,
    system: SystemStatusModel,
  })
  .views((self) => {
    return {
      get connectionSnapshot(): TConnectionStatusSnapshot {
        return self.connection.snapshot;
      },
      get autoConnectorSnapshot(): TAutoConnectorStatusSnapshot {
        return self.autoConnector.snapshot;
      },
      get callSnapshot(): TCallStatusSnapshot {
        return self.call.snapshot;
      },
      get callSessionSnapshot(): TCallSessionStatusSnapshot {
        return self.callSession.snapshot;
      },
      get incomingSnapshot(): TIncomingStatusSnapshot {
        return self.incoming.snapshot;
      },
      get presentationSnapshot(): TPresentationStatusSnapshot {
        return self.presentation.snapshot;
      },
      get systemSnapshot(): TSystemStatusSnapshot {
        return self.system.snapshot;
      },
    };
  })
  .actions((self) => {
    return {
      syncFromSessionSnapshot(snapshot: TSessionSnapshot) {
        const nextSnapshot = createStatusesRootSnapshotFromSession(snapshot);

        applySnapshot(self.connection, nextSnapshot.connection);
        applySnapshot(self.autoConnector, nextSnapshot.autoConnector);
        applySnapshot(self.call, nextSnapshot.call);
        applySnapshot(self.incoming, nextSnapshot.incoming);
        applySnapshot(self.presentation, nextSnapshot.presentation);
        applySnapshot(self.system, nextSnapshot.system);
      },
      syncFromCallSessionSnapshot(snapshot: TCallSessionSnapshot) {
        applySnapshot(self.callSession, createCallSessionStatusSnapshot(snapshot));
      },
    };
  });

export type TStatusesRootSnapshotOut = SnapshotOut<typeof StatusesRootModel>;

export const INITIAL_STATUSES_ROOT_SNAPSHOT = {
  connection: INITIAL_CONNECTION_STATUS_SNAPSHOT,
  autoConnector: INITIAL_AUTO_CONNECTOR_STATUS_SNAPSHOT,
  call: INITIAL_CALL_STATUS_SNAPSHOT,
  callSession: INITIAL_CALL_SESSION_STATUS_SNAPSHOT,
  incoming: INITIAL_INCOMING_STATUS_SNAPSHOT,
  presentation: INITIAL_PRESENTATION_STATUS_SNAPSHOT,
  system: INITIAL_SYSTEM_STATUS_SNAPSHOT,
} as SnapshotIn<typeof StatusesRootModel>;
