import { resolveRequesterByTimeout } from '@krivega/timeout-requester';

import resolveDebug from '@/logger';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';

const INTERVAL_PING_SERVER_REQUEST = 15_000;
const MAX_FAIL_REQUESTS_COUNT = 2;

const debug = resolveDebug('AutoConnectorManager: PingServerRequester');

class PingServerRequester {
  private readonly connectionManager: ConnectionManager;

  private readonly callManager: CallManager;

  private pingServerByTimeout: ReturnType<typeof resolveRequesterByTimeout> | undefined = undefined;

  private failRequestsCount = 0;

  private isFailRequestReported = false;

  public constructor({
    connectionManager,
    callManager,
  }: {
    connectionManager: ConnectionManager;
    callManager: CallManager;
  }) {
    this.connectionManager = connectionManager;
    this.callManager = callManager;
  }

  public start({ onFailRequest }: { onFailRequest: () => void }) {
    debug('start');
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

        debug('failRequestsCount', this.failRequestsCount);

        if (this.failRequestsCount < MAX_FAIL_REQUESTS_COUNT || this.isFailRequestReported) {
          debug(
            'failRequestsCount < MAX_FAIL_REQUESTS_COUNT || isFailRequestReported',
            this.failRequestsCount,
            MAX_FAIL_REQUESTS_COUNT,
            this.isFailRequestReported,
          );

          return;
        }

        // Reconnect перезапускает UA и обрывает звонок, поэтому во время звонка ping остаётся только keepalive.
        if (this.callManager.isCallActive) {
          debug('skip reporting fail request: call is active');

          return;
        }

        this.isFailRequestReported = true;
        debug('isFailRequestReported', this.isFailRequestReported);
        onFailRequest();
      },
    });
  }

  public stop() {
    debug('stop');
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
