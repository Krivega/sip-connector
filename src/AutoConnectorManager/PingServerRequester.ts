import { requesterByTimeoutsWithFailCalls } from '@krivega/timeout-requester';

import logger from '@/logger';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';

const INTERVAL_PING_SERVER_REQUEST = 15_000;
const MAX_FAIL_REQUESTS_COUNT = 2;

class PingServerRequester {
  private readonly connectionManager: ConnectionManager;

  private readonly callManager: CallManager;

  private readonly pingServerByTimeoutWithFailCalls: ReturnType<
    typeof requesterByTimeoutsWithFailCalls<ReturnType<typeof this.connectionManager.ping>>
  >;

  private disposerCallStatusChange: (() => void) | undefined;

  public constructor({
    connectionManager,
    callManager,
  }: {
    connectionManager: ConnectionManager;
    callManager: CallManager;
  }) {
    this.connectionManager = connectionManager;
    this.callManager = callManager;

    this.pingServerByTimeoutWithFailCalls = requesterByTimeoutsWithFailCalls<
      ReturnType<typeof this.connectionManager.ping>
    >(MAX_FAIL_REQUESTS_COUNT, {
      whenPossibleRequest: async () => {},
      requestInterval: INTERVAL_PING_SERVER_REQUEST,
      request: async () => {
        logger('ping');

        return this.connectionManager.ping().then(() => {
          logger('ping success');
        });
      },
    });
  }

  public start({ onFailRequest }: { onFailRequest: () => void }) {
    logger('start');

    this.disposerCallStatusChange = this.callManager.on('call-status-changed', () => {
      this.handleCallStatusChange({ onFailRequest });
    });

    this.handleCallStatusChange({ onFailRequest });
  }

  public stop() {
    logger('stop');

    this.pingServerByTimeoutWithFailCalls.stop();
    this.unsubscribeCallStatusChange();
  }

  private unsubscribeCallStatusChange() {
    this.disposerCallStatusChange?.();
    this.disposerCallStatusChange = undefined;
  }

  private handleCallStatusChange({ onFailRequest }: { onFailRequest: () => void }) {
    if (this.callManager.isCallActive) {
      this.pingServerByTimeoutWithFailCalls.stop();
    } else {
      this.pingServerByTimeoutWithFailCalls.start(undefined, { onFailRequest }).catch(logger);
    }
  }
}

export default PingServerRequester;
