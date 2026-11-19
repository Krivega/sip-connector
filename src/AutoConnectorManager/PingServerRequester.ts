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

  private startPing: (() => void) | undefined = undefined;

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

  public get isStarted(): boolean {
    return this.startPing !== undefined;
  }

  public start({
    onFailRequest,
    onPingSucceeded,
    onPingFailedInCall,
  }: {
    onFailRequest: () => void;
    onPingSucceeded: () => void;
    onPingFailedInCall: ({ failCount, error }: { failCount: number; error: unknown }) => void;
  }) {
    debug('start');
    this.stop();

    const pingServerByTimeout: ReturnType<typeof resolveRequesterByTimeout> =
      resolveRequesterByTimeout({
        isDontStopOnFail: true,
        requestInterval: INTERVAL_PING_SERVER_REQUEST,
        request: async () => {
          debug('ping');

          return this.connectionManager.ping().then(() => {
            debug('ping success');
          });
        },
      });
    const requestHandlers = {
      onSuccessRequest: () => {
        this.resetFailRequests();
        onPingSucceeded();
      },
      onFailRequest: (error: unknown) => {
        this.failRequestsCount += 1;

        debug('failRequestsCount', this.failRequestsCount);

        // Reconnect перезапускает UA и обрывает звонок, поэтому во время звонка переоткрывается только транспорт.
        if (this.callManager.isCallActive) {
          debug('skip reporting fail request: call is active');
          onPingFailedInCall({ failCount: this.failRequestsCount, error });

          return;
        }

        if (this.failRequestsCount < MAX_FAIL_REQUESTS_COUNT || this.isFailRequestReported) {
          debug(
            'failRequestsCount < MAX_FAIL_REQUESTS_COUNT || isFailRequestReported',
            this.failRequestsCount,
            MAX_FAIL_REQUESTS_COUNT,
            this.isFailRequestReported,
          );

          return;
        }

        this.isFailRequestReported = true;
        debug('isFailRequestReported', this.isFailRequestReported);
        onFailRequest();
      },
    };

    this.pingServerByTimeout = pingServerByTimeout;
    this.startPing = () => {
      pingServerByTimeout.start(undefined, requestHandlers);
    };
    this.startPing();
  }

  public stop() {
    debug('stop');
    this.pingServerByTimeout?.stop();
    this.pingServerByTimeout = undefined;
    this.startPing = undefined;
    this.resetFailRequests();
  }

  public pingImmediately() {
    this.startPing?.();
  }

  private resetFailRequests() {
    this.failRequestsCount = 0;
    this.isFailRequestReported = false;
  }
}

export default PingServerRequester;
