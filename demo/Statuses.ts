import { reaction } from 'mobx';
import { getSnapshot } from 'mobx-state-tree';

import sipConnectorFacade from './Session/sipConnectorFacade';
import { INITIAL_STATUSES_ROOT_SNAPSHOT, StatusesRootModel } from './StatusesRoot';

import type { TCallSessionSnapshot, TSessionSnapshot } from '@/index';
import type {
  TStatusesByDomain,
  TStatusesRootSnapshotOut,
  TStatusesRootSnapshot,
} from './StatusesRoot';

export type TCallReconnectIndicatorState = {
  state: string;
  isReconnecting: boolean;
  isErrorTerminal: boolean;
  attempt: number;
  nextDelayMs: number;
  lastFailureCause: string | undefined;
  lastError: unknown;
  cancelledReason: unknown;
};

class Statuses {
  private readonly unsubsribers = new Set<() => void>();

  private readonly statusesStore = StatusesRootModel.create(INITIAL_STATUSES_ROOT_SNAPSHOT);

  public subscribe() {
    this.subscribeSessionStatuses(this.syncSystemStatuses, this.syncCallSessionStatuses);
  }

  public getStatusesWithContext(): TStatusesRootSnapshotOut {
    return getSnapshot(this.statusesStore);
  }

  public getStatusSnapshots(): TStatusesRootSnapshot {
    return {
      system: this.statusesStore.systemSnapshot as TStatusesRootSnapshot['system'],
      connection: this.statusesStore.connectionSnapshot,
      autoConnector: this.statusesStore.autoConnectorSnapshot,
      callReconnect: this.statusesStore.callReconnectSnapshot,
      call: this.statusesStore.callSnapshot,
      callSession: this.statusesStore.callSessionSnapshot,
      incoming: this.statusesStore.incomingSnapshot,
      presentation: this.statusesStore.presentationSnapshot,
    };
  }

  public onChangeSystemState(
    callback: (
      payload: {
        isDisconnected: boolean;
        isDisconnecting: boolean;
        isConnecting: boolean;
        isReadyToCall: boolean;
        isCallConnecting: boolean;
        isCallDisconnecting: boolean;
        isCallActive: boolean;
      } & TStatusesByDomain,
    ) => void,
  ) {
    return reaction(
      () => {
        return {
          connection: this.statusesStore.connection.state,
          autoConnector: this.statusesStore.autoConnector.state,
          callReconnect: this.statusesStore.callReconnect.state,
          call: this.statusesStore.call.state,
          incoming: this.statusesStore.incoming.state,
          presentation: this.statusesStore.presentation.state,
          system: this.statusesStore.system.state,
          isDisconnected: this.statusesStore.system.isDisconnected(),
          isDisconnecting: this.statusesStore.system.isDisconnecting(),
          isConnecting: this.statusesStore.system.isConnecting(),
          isReadyToCall: this.statusesStore.system.isReadyToCall(),
          isCallConnecting: this.statusesStore.system.isCallConnecting(),
          isCallDisconnecting: this.statusesStore.system.isCallDisconnecting(),
          isCallActive: this.statusesStore.system.isCallActive(),
        };
      },
      (payload) => {
        callback(payload);
      },
      {
        fireImmediately: true,
      },
    );
  }

  public onChangeParticipantRole(
    callback: (payload: {
      isAvailableSendingMedia: boolean;
      isSpectatorRoleAny: boolean;
      isSpectator: boolean;
      isParticipant: boolean;
    }) => void,
  ) {
    return reaction(
      () => {
        return {
          isAvailableSendingMedia: this.statusesStore.callSession.isAvailableSendingMedia,
          isSpectatorRoleAny: this.statusesStore.callSession.isSpectatorRoleAny(),
          isSpectator: this.statusesStore.callSession.isSpectator(),
          isParticipant: this.statusesStore.callSession.isParticipant(),
        };
      },
      ({ isAvailableSendingMedia, isSpectatorRoleAny, isSpectator, isParticipant }) => {
        callback({ isAvailableSendingMedia, isSpectatorRoleAny, isSpectator, isParticipant });
      },
      { fireImmediately: true },
    );
  }

  /**
   * Подписывается на изменения состояния авто-редиала звонка.
   * Колбек получает MST-инстанс домена `callReconnect`.
   */
  public onChangeCallReconnect(callback: (state: TCallReconnectIndicatorState) => void) {
    return reaction(
      (): TCallReconnectIndicatorState => {
        return {
          state: this.statusesStore.callReconnect.state,
          attempt: this.statusesStore.callReconnect.attempt,
          nextDelayMs: this.statusesStore.callReconnect.nextDelayMs,
          lastFailureCause: this.statusesStore.callReconnect.lastFailureCause,
          lastError: this.statusesStore.callReconnect.lastError,
          cancelledReason: this.statusesStore.callReconnect.cancelledReason,
          isReconnecting: this.statusesStore.callReconnect.isReconnecting(),
          isErrorTerminal: this.statusesStore.callReconnect.isErrorTerminal(),
        };
      },
      (state) => {
        callback(state);
      },
      { fireImmediately: true },
    );
  }

  private readonly syncSystemStatuses = (sessionSnapshot: TSessionSnapshot) => {
    this.statusesStore.syncFromSessionSnapshot(sessionSnapshot);
  };

  private readonly syncCallSessionStatuses = (callSessionSnapshot: TCallSessionSnapshot) => {
    this.statusesStore.syncFromCallSessionSnapshot(callSessionSnapshot);
  };

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

  private unsubscribe() {
    this.unsubsribers.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.unsubsribers.clear();
  }

  private subscribeSessionStatuses(
    onSessionSnapshot: (snapshot: TSessionSnapshot) => void,
    onCallSessionSnapshot: (snapshot: TCallSessionSnapshot) => void,
  ) {
    this.unsubscribe();
    onSessionSnapshot(this.getSessionSnapshot());
    onCallSessionSnapshot(this.getCallSessionSnapshot());

    this.unsubsribers.add(
      sipConnectorFacade.sipConnector.sessionManager.subscribe(onSessionSnapshot),
    );
    this.unsubsribers.add(
      sipConnectorFacade.sipConnector.callSessionState.subscribe(onCallSessionSnapshot),
    );
  }
}

export default Statuses;
