import { getSnapshot } from 'mobx-state-tree';

import sipConnectorFacade from './Session/sipConnectorFacade';
import { INITIAL_STATUSES_ROOT_SNAPSHOT, StatusesRootModel } from './StatusesRoot';

import type { TCallSessionSnapshot, TSessionSnapshot } from '@/index';
import type {
  TStatusesByDomain,
  TStatusesRootSnapshotOut,
  TStatusesRootSnapshot,
} from './StatusesRoot';

class Statuses {
  private unsubscribeSessionStatuses?: () => void;

  private readonly statusesStore = StatusesRootModel.create(INITIAL_STATUSES_ROOT_SNAPSHOT);

  public subscribe(onStatusesChange: (statuses: TStatusesByDomain) => void) {
    this.subscribeSessionStatuses((snapshot) => {
      this.statusesStore.syncFromSessionSnapshot(snapshot);

      const callSessionSnapshot = this.getCallSessionSnapshot();

      this.statusesStore.syncFromCallSessionSnapshot(callSessionSnapshot);

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

  public getStatusesWithContext(): TStatusesRootSnapshotOut {
    return getSnapshot(this.statusesStore);
  }

  public getStatusSnapshots(): TStatusesRootSnapshot {
    return {
      connection: this.statusesStore.connectionSnapshot,
      autoConnector: this.statusesStore.autoConnectorSnapshot,
      call: this.statusesStore.callSnapshot,
      callSession: this.statusesStore.callSessionSnapshot,
      incoming: this.statusesStore.incomingSnapshot,
      presentation: this.statusesStore.presentationSnapshot,
      system: this.statusesStore.systemSnapshot as TStatusesRootSnapshot['system'],
    };
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private getSessionSnapshot() {
    const { sessionManager } = sipConnectorFacade.sipConnector;

    return sessionManager.getSnapshot();
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private getCallSessionSnapshot(): TCallSessionSnapshot {
    const { sipConnector } = sipConnectorFacade;

    return sipConnector.callSessionState.getSnapshot();
  }

  private subscribeSessionStatuses(onSnapshot: (snapshot: TSessionSnapshot) => void) {
    this.unsubscribeSessionStatuses?.();
    onSnapshot(this.getSessionSnapshot());

    const { sessionManager } = sipConnectorFacade.sipConnector;

    this.unsubscribeSessionStatuses = sessionManager.subscribe(onSnapshot);
  }
}

export default Statuses;
