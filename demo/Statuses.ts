import { sessionSelectors } from '../src';
import sipConnectorFacade from './Session/sipConnectorFacade';

import type { TSessionSnapshot } from '../src';

class Statuses {
  private unsubscribeSessionStatuses?: () => void;

  public subscribe(
    onStatusesChange: (statuses: {
      connection: string;
      call: string;
      incoming: string;
      presentation: string;
    }) => void,
  ) {
    this.subscribeSessionStatuses((snapshot) => {
      onStatusesChange({
        connection: sessionSelectors.selectConnectionStatus(snapshot),
        call: sessionSelectors.selectCallStatus(snapshot),
        incoming: sessionSelectors.selectIncomingStatus(snapshot),
        presentation: sessionSelectors.selectPresentationStatus(snapshot),
      });
    });
  }

  private subscribeSessionStatuses(onSnapshot: (snapshot: TSessionSnapshot) => void) {
    this.unsubscribeSessionStatuses?.();

    const { session } = sipConnectorFacade.sipConnector;

    onSnapshot(session.getSnapshot());
    this.unsubscribeSessionStatuses = session.subscribe(onSnapshot);
  }
}

export default Statuses;
