import { sessionSelectors } from '@/index';
import sipConnectorFacade from './Session/sipConnectorFacade';

import type { TSessionSnapshot } from '@/index';

class Statuses {
  private unsubscribeSessionStatuses?: () => void;

  public subscribe(
    onStatusesChange: (statuses: {
      connection: string;
      call: string;
      incoming: string;
      presentation: string;
      system: string;
    }) => void,
  ) {
    this.subscribeSessionStatuses((snapshot) => {
      onStatusesChange({
        connection: sessionSelectors.selectConnectionStatus(snapshot),
        call: sessionSelectors.selectCallStatus(snapshot),
        incoming: sessionSelectors.selectIncomingStatus(snapshot),
        presentation: sessionSelectors.selectPresentationStatus(snapshot),
        system: sessionSelectors.selectSystemStatus(snapshot),
      });
    });
  }

  private subscribeSessionStatuses(onSnapshot: (snapshot: TSessionSnapshot) => void) {
    this.unsubscribeSessionStatuses?.();

    const { sessionManager } = sipConnectorFacade.sipConnector;

    onSnapshot(sessionManager.getSnapshot());
    this.unsubscribeSessionStatuses = sessionManager.subscribe(onSnapshot);
  }
}

export default Statuses;
