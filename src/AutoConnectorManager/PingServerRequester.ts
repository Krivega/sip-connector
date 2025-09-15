import { requesterByTimeoutsWithFailCalls } from '@krivega/timeout-requester';

import logger from '@/logger';
import CallStatusSubscriber from './CallStatusSubscriber';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';

const INTERVAL_PING_SERVER_REQUEST = 15_000;
const MAX_FAIL_REQUESTS_COUNT = 2;

class PingServerRequester {
  private readonly connectionManager: ConnectionManager;

  private readonly callStatusSubscriber: CallStatusSubscriber;

  private readonly pingServerByTimeoutWithFailCalls: ReturnType<
    typeof requesterByTimeoutsWithFailCalls<ReturnType<typeof this.connectionManager.ping>>
  >;

  public constructor({
    connectionManager,
    callManager,
  }: {
    connectionManager: ConnectionManager;
    callManager: CallManager;
  }) {
    this.connectionManager = connectionManager;

    this.callStatusSubscriber = new CallStatusSubscriber({ callManager });

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
    logger('ping start');

    this.callStatusSubscriber.subscribe((isCallActive) => {
      if (isCallActive) {
        this.pingServerByTimeoutWithFailCalls.stop();
      } else {
        this.pingServerByTimeoutWithFailCalls.start(undefined, { onFailRequest }).catch(logger);
      }
    });
  }

  public stop() {
    logger('ping stop');

    this.pingServerByTimeoutWithFailCalls.stop();
    this.callStatusSubscriber.unsubscribe();
  }
}

export default PingServerRequester;
