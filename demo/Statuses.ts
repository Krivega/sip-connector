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
      autoConnectorManager: string;
    }) => void,
  ) {
    this.subscribeSessionStatuses((snapshot) => {
      onStatusesChange({
        connection: sessionSelectors.selectConnectionStatus(snapshot),
        call: sessionSelectors.selectCallStatus(snapshot),
        incoming: sessionSelectors.selectIncomingStatus(snapshot),
        presentation: sessionSelectors.selectPresentationStatus(snapshot),
        system: sessionSelectors.selectSystemStatus(snapshot),
        autoConnectorManager: snapshot.autoConnector.value,
      });
    });
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private getStatuses() {
    const { sessionManager } = sipConnectorFacade.sipConnector;

    return sessionManager.getSnapshot();
  }

  private subscribeSessionStatuses(onSnapshot: (snapshot: TSessionSnapshot) => void) {
    this.unsubscribeSessionStatuses?.();
    onSnapshot(this.getStatuses());

    const { sessionManager } = sipConnectorFacade.sipConnector;

    this.unsubscribeSessionStatuses = sessionManager.subscribe(onSnapshot);
  }
}

export default Statuses;
