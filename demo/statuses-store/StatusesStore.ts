import { applySnapshot, types } from 'mobx-state-tree';

import {
  AutoConnectorNodeModel,
  mapAutoConnectorNodeFromSessionSnapshot,
  INITIAL_AUTO_CONNECTOR_NODE_SNAPSHOT,
} from './autoConnector/AutoConnectorStatusesNode';
import {
  CallNodeModel,
  mapCallNodeFromSessionSnapshot,
  INITIAL_CALL_NODE_SNAPSHOT,
} from './call/CallStatusesNode';
import {
  ConnectionNodeModel,
  mapConnectionNodeFromSessionSnapshot,
  INITIAL_CONNECTION_NODE_SNAPSHOT,
} from './connection/ConnectionStatusesNode';
import {
  IncomingNodeModel,
  mapIncomingNodeFromSessionSnapshot,
  INITIAL_INCOMING_NODE_SNAPSHOT,
} from './incoming/IncomingStatusesNode';
import {
  PresentationNodeModel,
  mapPresentationNodeFromSessionSnapshot,
  INITIAL_PRESENTATION_NODE_SNAPSHOT,
} from './presentation/PresentationStatusesNode';
import {
  SystemNodeModel,
  mapSystemNodeFromSessionSnapshot,
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

export type TStatusStates = {
  connection: EConnectionStatus;
  call: ECallStatus;
  incoming: EIncomingStatus;
  presentation: EPresentationStatus;
  system: ESystemStatus;
  autoConnector: EAutoConnectorStatus;
};

function mapStatusesStoreSnapshotFromSessionSnapshot(
  snapshot: TSessionSnapshot,
): SnapshotIn<typeof StatusesStoreModel> {
  return {
    connection: mapConnectionNodeFromSessionSnapshot(snapshot),
    autoConnector: mapAutoConnectorNodeFromSessionSnapshot(snapshot),
    call: mapCallNodeFromSessionSnapshot(snapshot),
    incoming: mapIncomingNodeFromSessionSnapshot(snapshot),
    presentation: mapPresentationNodeFromSessionSnapshot(snapshot),
    system: mapSystemNodeFromSessionSnapshot(snapshot),
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
      applySessionSnapshot(snapshot: TSessionSnapshot) {
        applySnapshot(self, mapStatusesStoreSnapshotFromSessionSnapshot(snapshot));
      },
    };
  });

export type TStatusesStoreSnapshotOut = SnapshotOut<typeof StatusesStoreModel>;

export const INITIAL_STATUSES_STORE_SNAPSHOT = {
  connection: INITIAL_CONNECTION_NODE_SNAPSHOT,
  autoConnector: INITIAL_AUTO_CONNECTOR_NODE_SNAPSHOT,
  call: INITIAL_CALL_NODE_SNAPSHOT,
  incoming: INITIAL_INCOMING_NODE_SNAPSHOT,
  presentation: INITIAL_PRESENTATION_NODE_SNAPSHOT,
  system: INITIAL_SYSTEM_NODE_SNAPSHOT,
} as SnapshotIn<typeof StatusesStoreModel>;
