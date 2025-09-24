import logger from '@/logger';
import PingServerRequester from './PingServerRequester';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';

class PingServerIfNotActiveCallRequester {
  private readonly callManager: CallManager;

  private readonly pingServerRequester: PingServerRequester;

  private disposeCallStatusChange: (() => void) | undefined;

  public constructor({
    connectionManager,
    callManager,
  }: {
    connectionManager: ConnectionManager;
    callManager: CallManager;
  }) {
    this.callManager = callManager;

    this.pingServerRequester = new PingServerRequester({
      connectionManager,
    });
  }

  public start({ onFailRequest }: { onFailRequest: () => void }) {
    logger('start');

    this.disposeCallStatusChange = this.callManager.on('call-status-changed', () => {
      this.handleCallStatusChange({ onFailRequest });
    });

    this.handleCallStatusChange({ onFailRequest });
  }

  public stop() {
    logger('stop');

    this.pingServerRequester.stop();
    this.unsubscribeCallStatusChange();
  }

  private unsubscribeCallStatusChange() {
    this.disposeCallStatusChange?.();
    this.disposeCallStatusChange = undefined;
  }

  private handleCallStatusChange({ onFailRequest }: { onFailRequest: () => void }) {
    if (this.callManager.isCallActive) {
      this.pingServerRequester.stop();
    } else {
      this.pingServerRequester.start({ onFailRequest });
    }
  }
}

export default PingServerIfNotActiveCallRequester;
