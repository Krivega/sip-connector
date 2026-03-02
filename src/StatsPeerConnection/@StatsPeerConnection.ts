import { CancelableRequest } from '@krivega/cancelable-promise';
import { SetTimeoutRequest } from '@krivega/timeout-requester';

import { EventEmitterProxy } from '@/EventEmitterProxy';
import log from '@/logger';
import { INTERVAL_COLLECT_STATISTICS } from './constants';
import { createEvents } from './events';
import parseStatsReports from './parseStatsReports';
import requestAllStatistics from './requestAllStatistics';
import { now } from './utils';

import type { TEventMap } from './events';

const debug = (data: unknown) => {
  log(String(data));
};

class StatsPeerConnection extends EventEmitterProxy<TEventMap> {
  private readonly setTimeoutRequest: SetTimeoutRequest;

  private readonly requesterAllStatistics = new CancelableRequest<
    RTCPeerConnection,
    ReturnType<typeof requestAllStatistics>
  >(requestAllStatistics);

  public constructor() {
    super(createEvents());

    this.setTimeoutRequest = new SetTimeoutRequest();
  }

  public get requested(): boolean {
    return this.setTimeoutRequest.requested;
  }

  public start(
    getPeerConnection: () => RTCPeerConnection | undefined,
    {
      interval = INTERVAL_COLLECT_STATISTICS,
      onError = debug,
    }: {
      onError?: (error: unknown) => void;
      interval?: number;
    } = {},
  ) {
    this.stop();
    this.setTimeoutRequest.request(() => {
      this.collectStatistics(getPeerConnection, {
        onError,
      });
    }, interval);
  }

  public stop() {
    this.setTimeoutRequest.cancelRequest();
    this.requesterAllStatistics.cancelRequest();
  }

  private readonly collectStatistics = (
    getPeerConnection: () => RTCPeerConnection | undefined,
    {
      onError,
    }: {
      onError?: (error: unknown) => void;
    },
  ) => {
    const startTime = now();

    this.requestAllStatistics(getPeerConnection)
      .then((allStatistics) => {
        this.events.trigger('collected', parseStatsReports(allStatistics));

        const endTime = now();
        const elapsed = endTime - startTime;

        let interval = INTERVAL_COLLECT_STATISTICS;

        if (elapsed > 48) {
          interval = INTERVAL_COLLECT_STATISTICS * 4;
        } else if (elapsed > 32) {
          interval = INTERVAL_COLLECT_STATISTICS * 3;
        } else if (elapsed > 16) {
          interval = INTERVAL_COLLECT_STATISTICS * 2;
        }

        this.start(getPeerConnection, {
          onError,
          interval,
        });
      })
      .catch((error: unknown) => {
        if (onError) {
          onError(error);
        }
      });
  };

  private readonly requestAllStatistics = async (
    getPeerConnection: () => RTCPeerConnection | undefined,
  ) => {
    const peerConnection = getPeerConnection();

    if (peerConnection === undefined) {
      throw new Error('failed to collect statistics: peerConnection is not defined');
    }

    return this.requesterAllStatistics.request(peerConnection);
  };
}

export default StatsPeerConnection;
