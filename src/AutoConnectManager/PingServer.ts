import { requesterByTimeoutsWithFailCalls } from '@krivega/timeout-requester';

import debug from '@/logger';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';

const INTERVAL_PING_SERVER_REQUEST = 15_000;
const MAX_FAIL_REQUESTS_COUNT = 2;

class PingServer {
  private readonly callManager: CallManager;

  private readonly connectionManager: ConnectionManager;

  private readonly pingServerByTimeoutWithFailCalls: ReturnType<
    typeof requesterByTimeoutsWithFailCalls<ReturnType<typeof this.connectionManager.ping>>
  >;

  private unsubscribeFromCallStatus?: () => void;

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
        debug('ping');

        return this.connectionManager.ping().then(() => {
          debug('ping success');
        });
      },
    });
  }

  public start() {
    debug('start');

    this.unsubscribeFromCallStatus = this.callManager.onChangeCallStatus((isCallActive) => {
      if (isCallActive) {
        this.pingServerByTimeoutWithFailCalls.stop();
      } else {
        this.pingServerByTimeoutWithFailCalls.start().catch(debug);
      }
    });
  }

  public stop() {
    debug('stop');

    this.unsubscribeFromCallStatus?.();
    this.pingServerByTimeoutWithFailCalls.stop();
  }
}

export default PingServer;
