import { applySnapshot, types } from 'mobx-state-tree';

import {
  AutoConnectorNodeModel,
  buildAutoConnectorNodeFromSession,
  INITIAL_AUTO_CONNECTOR_NODE_SNAPSHOT,
} from './autoConnector/AutoConnectorStatusesNode';
import {
  CallNodeModel,
  buildCallNodeFromSession,
  INITIAL_CALL_NODE_SNAPSHOT,
} from './call/CallStatusesNode';
import {
  ConnectionNodeModel,
  buildConnectionNodeFromSession,
  INITIAL_CONNECTION_NODE_SNAPSHOT,
} from './connection/ConnectionStatusesNode';
import {
  IncomingNodeModel,
  buildIncomingNodeFromSession,
  INITIAL_INCOMING_NODE_SNAPSHOT,
} from './incoming/IncomingStatusesNode';
import {
  PresentationNodeModel,
  buildPresentationNodeFromSession,
  INITIAL_PRESENTATION_NODE_SNAPSHOT,
} from './presentation/PresentationStatusesNode';
import {
  SystemNodeModel,
  buildSystemNodeFromSession,
  INITIAL_SYSTEM_NODE_SNAPSHOT,
} from './system/SystemStatusesNode';

import type { SnapshotIn, SnapshotOut } from 'mobx-state-tree';
import type { EAutoConnectorState as EAutoConnectorStatus } from '@/AutoConnectorManager/AutoConnectorStateMachine';
import type {
  ECallStatus,
  EConnectionStatus,
  EIncomingStatus,
  EPresentationStatus,
  ESystemStatus,
  TSessionSnapshot,
} from '@/index';
import type { TAutoConnectorNodeValue } from './autoConnector/AutoConnectorStatusesNode';
import type { TCallNodeValue } from './call/CallStatusesNode';
import type { TConnectionNodeValue } from './connection/ConnectionStatusesNode';
import type { TIncomingNodeValue } from './incoming/IncomingStatusesNode';
import type { TPresentationNodeValue } from './presentation/PresentationStatusesNode';
import type { TSystemNodeValue } from './system/SystemStatusesNode';

export type {
  TAutoConnectorStopReason,
  TAutoConnectorNodeValue,
} from './autoConnector/AutoConnectorStatusesNode';
export type { TCallNodeValue } from './call/CallStatusesNode';
export type { TConnectionNodeValue } from './connection/ConnectionStatusesNode';
export type { TIncomingNodeValue } from './incoming/IncomingStatusesNode';
export type { TPresentationNodeValue } from './presentation/PresentationStatusesNode';
export type { TSystemNodeValue } from './system/SystemStatusesNode';

export type TStatusesStoreSnapshot = {
  connection: TConnectionNodeValue;
  autoConnector: TAutoConnectorNodeValue;
  call: TCallNodeValue;
  incoming: TIncomingNodeValue;
  presentation: TPresentationNodeValue;
  system: SnapshotIn<typeof SystemNodeModel>;
};

export type TPublicStatuses = {
  connection: EConnectionStatus;
  call: ECallStatus;
  incoming: EIncomingStatus;
  presentation: EPresentationStatus;
  system: ESystemStatus;
  autoConnector: EAutoConnectorStatus;
};

function buildStatusesStoreSnapshotFromSession(
  snapshot: TSessionSnapshot,
): SnapshotIn<typeof StatusesStoreModel> {
  return {
    connection: buildConnectionNodeFromSession(snapshot),
    autoConnector: buildAutoConnectorNodeFromSession(snapshot),
    call: buildCallNodeFromSession(snapshot),
    incoming: buildIncomingNodeFromSession(snapshot),
    presentation: buildPresentationNodeFromSession(snapshot),
    system: buildSystemNodeFromSession(snapshot),
  };
}

export const StatusesStoreModel = types
  .model({
    connection: ConnectionNodeModel,
    autoConnector: AutoConnectorNodeModel,
    call: CallNodeModel,
    incoming: IncomingNodeModel,
    presentation: PresentationNodeModel,
    system: SystemNodeModel,
  })
  .views((self) => {
    return {
      get connectionNode(): TConnectionNodeValue {
        return self.connection.nodeValue;
      },
      get autoConnectorNode(): TAutoConnectorNodeValue {
        return self.autoConnector.nodeValue;
      },
      get callNode(): TCallNodeValue {
        return self.call.nodeValue;
      },
      get incomingNode(): TIncomingNodeValue {
        return self.incoming.nodeValue;
      },
      get presentationNode(): TPresentationNodeValue {
        return self.presentation.nodeValue;
      },
      get systemNode(): TSystemNodeValue {
        return self.system.nodeValue;
      },
    };
  })
  .actions((self) => {
    return {
      syncFromSessionSnapshot(snapshot: TSessionSnapshot) {
        applySnapshot(self, buildStatusesStoreSnapshotFromSession(snapshot));
      },
    };
  });

export type TStatusesStoreOutput = SnapshotOut<typeof StatusesStoreModel>;

export const INITIAL_STATUSES_STORE_SNAPSHOT = {
  connection: INITIAL_CONNECTION_NODE_SNAPSHOT,
  autoConnector: INITIAL_AUTO_CONNECTOR_NODE_SNAPSHOT,
  call: INITIAL_CALL_NODE_SNAPSHOT,
  incoming: INITIAL_INCOMING_NODE_SNAPSHOT,
  presentation: INITIAL_PRESENTATION_NODE_SNAPSHOT,
  system: INITIAL_SYSTEM_NODE_SNAPSHOT,
} as SnapshotIn<typeof StatusesStoreModel>;
