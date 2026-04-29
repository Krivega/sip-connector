import { resolveRequesterByTimeout } from '@krivega/timeout-requester';

import resolveDebug from '@/logger';

import type { ConnectionManager } from '@/ConnectionManager';

const INTERVAL_PING_SERVER_REQUEST = 15_000;
const MAX_FAIL_REQUESTS_COUNT = 2;

const debug = resolveDebug('AutoConnectorManager: PingServerRequester');

class PingServerRequester {
  private readonly connectionManager: ConnectionManager;

  private pingServerByTimeout: ReturnType<typeof resolveRequesterByTimeout> | undefined = undefined;

  private failRequestsCount = 0;

  private isFailRequestReported = false;

  public constructor({ connectionManager }: { connectionManager: ConnectionManager }) {
    this.connectionManager = connectionManager;
  }

  public start({ onFailRequest }: { onFailRequest: () => void }) {
    this.stop();

    this.pingServerByTimeout = resolveRequesterByTimeout({
      isDontStopOnFail: true,
      requestInterval: INTERVAL_PING_SERVER_REQUEST,
      request: async () => {
        debug('ping');

        return this.connectionManager.ping().then(() => {
          debug('ping success');
        });
      },
    });

    this.pingServerByTimeout.start(undefined, {
      onSuccessRequest: () => {
        this.resetFailRequests();
      },
      onFailRequest: () => {
        this.failRequestsCount += 1;

        if (this.failRequestsCount < MAX_FAIL_REQUESTS_COUNT || this.isFailRequestReported) {
          return;
        }

        this.isFailRequestReported = true;
        onFailRequest();
      },
    });
  }

  public stop() {
    this.pingServerByTimeout?.stop();
    this.pingServerByTimeout = undefined;
    this.resetFailRequests();
  }

  private resetFailRequests() {
    this.failRequestsCount = 0;
    this.isFailRequestReported = false;
  }
}

export default PingServerRequester;
