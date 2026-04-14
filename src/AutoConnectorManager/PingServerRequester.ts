import { requesterByTimeoutsWithFailCalls } from '@krivega/timeout-requester';

import resolveDebug from '@/logger';

import type { ConnectionManager } from '@/ConnectionManager';

const INTERVAL_PING_SERVER_REQUEST = 15_000;
const MAX_FAIL_REQUESTS_COUNT = 2;

const debug = resolveDebug('PingServerRequester');

class PingServerRequester {
  private readonly connectionManager: ConnectionManager;

  private readonly pingServerByTimeoutWithFailCalls: ReturnType<
    typeof requesterByTimeoutsWithFailCalls<ReturnType<typeof this.connectionManager.ping>>
  >;

  public constructor({ connectionManager }: { connectionManager: ConnectionManager }) {
    this.connectionManager = connectionManager;

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

  public start({ onFailRequest }: { onFailRequest: () => void }) {
    this.pingServerByTimeoutWithFailCalls.start(undefined, { onFailRequest }).catch(debug);
  }

  public stop() {
    this.pingServerByTimeoutWithFailCalls.stop();
  }
}

export default PingServerRequester;
