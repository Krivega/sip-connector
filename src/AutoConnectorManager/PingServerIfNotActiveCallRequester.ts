import logger from '@/logger';
import NotActiveCallSubscriber from './NotActiveCallSubscriber';
import PingServerRequester from './PingServerRequester';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';

class PingServerIfNotActiveCallRequester {
  private readonly pingServerRequester: PingServerRequester;

  private readonly notActiveCallSubscriber: NotActiveCallSubscriber;

  public constructor({
    connectionManager,
    callManager,
  }: {
    connectionManager: ConnectionManager;
    callManager: CallManager;
  }) {
    this.pingServerRequester = new PingServerRequester({
      connectionManager,
    });

    this.notActiveCallSubscriber = new NotActiveCallSubscriber({ callManager });
  }

  public start({ onFailRequest }: { onFailRequest: () => void }) {
    logger('start');

    this.notActiveCallSubscriber.subscribe({
      onActive: () => {
        this.pingServerRequester.stop();
      },
      onInactive: () => {
        this.pingServerRequester.start({ onFailRequest });
      },
    });
  }

  public stop() {
    logger('stop');

    this.pingServerRequester.stop();
    this.unsubscribeCallStatusChange();
  }

  private unsubscribeCallStatusChange() {
    this.notActiveCallSubscriber.unsubscribe();
  }
}

export default PingServerIfNotActiveCallRequester;
