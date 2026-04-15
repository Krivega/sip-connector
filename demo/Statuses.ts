import { getSnapshot } from 'mobx-state-tree';

import sipConnectorFacade from './Session/sipConnectorFacade';
import { INITIAL_STATUSES_STORE_SNAPSHOT, StatusesStoreModel } from './statuses-store';

import type { TSessionSnapshot } from '@/index';
import type {
  TStatusStates,
  TStatusesStoreSnapshotOut,
  TStatusesStoreSnapshot,
} from './statuses-store';

class Statuses {
  private unsubscribeSessionStatuses?: () => void;

  private readonly statusesStore = StatusesStoreModel.create(INITIAL_STATUSES_STORE_SNAPSHOT);

  public subscribe(onStatusesChange: (statuses: TStatusStates) => void) {
    this.subscribeSessionStatuses((snapshot) => {
      this.statusesStore.applySessionSnapshot(snapshot);
      onStatusesChange({
        connection: this.statusesStore.connection.state,
        autoConnector: this.statusesStore.autoConnector.state,
        call: this.statusesStore.call.state,
        incoming: this.statusesStore.incoming.state,
        presentation: this.statusesStore.presentation.state,
        system: this.statusesStore.system.state,
      });
    });
  }

  public getStatusesWithContext(): TStatusesStoreSnapshotOut {
    return getSnapshot(this.statusesStore);
  }

  public getNodeValues(): TStatusesStoreSnapshot {
    return {
      connection: this.statusesStore.connectionNode,
      autoConnector: this.statusesStore.autoConnectorNode,
      call: this.statusesStore.callNode,
      incoming: this.statusesStore.incomingNode,
      presentation: this.statusesStore.presentationNode,
      system: this.statusesStore.systemNode as TStatusesStoreSnapshot['system'],
    };
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private getSessionSnapshot() {
    const { sessionManager } = sipConnectorFacade.sipConnector;

    return sessionManager.getSnapshot();
  }

  private subscribeSessionStatuses(onSnapshot: (snapshot: TSessionSnapshot) => void) {
    this.unsubscribeSessionStatuses?.();
    onSnapshot(this.getSessionSnapshot());

    const { sessionManager } = sipConnectorFacade.sipConnector;

    this.unsubscribeSessionStatuses = sessionManager.subscribe(onSnapshot);
  }
}

export default Statuses;
