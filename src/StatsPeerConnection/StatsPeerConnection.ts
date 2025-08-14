import { CancelableRequest } from '@krivega/cancelable-promise';
import { SetTimeoutRequest } from '@krivega/timeout-requester';
import { Events } from 'events-constructor';

import log from '@/logger';
import { INTERVAL_COLLECT_STATISTICS } from './constants';
import { COLLECTED_EVENT, EVENT_NAMES } from './eventNames';
import parseStatsReports from './parseStatsReports';
import requestAllStatistics from './requestAllStatistics';
import now from './utils/now';

import type { TInbound, TOutbound } from './typings';

const debug = (data: unknown) => {
  log(String(data));
};

class StatsPeerConnection {
  private readonly events: Events<typeof EVENT_NAMES>;

  private readonly setTimeoutRequest: SetTimeoutRequest;

  private readonly requesterAllStatistics = new CancelableRequest<
    RTCPeerConnection,
    ReturnType<typeof requestAllStatistics>
  >(requestAllStatistics);

  public constructor() {
    this.events = new Events<typeof EVENT_NAMES>(EVENT_NAMES);
    this.setTimeoutRequest = new SetTimeoutRequest();
  }

  public get requested(): boolean {
    return this.setTimeoutRequest.requested;
  }

  public start(
    peerConnection: RTCPeerConnection,
    {
      interval = INTERVAL_COLLECT_STATISTICS,
      onError = debug,
    }: {
      onError?: (error: unknown) => void;
      interval?: number;
    } = {},
  ) {
    const collectStatistics = this.resolveCollectStatistics(peerConnection, {
      onError,
    });

    this.stop();
    this.setTimeoutRequest.request(collectStatistics, interval);
  }

  public stop() {
    this.setTimeoutRequest.cancelRequest();
    this.requesterAllStatistics.cancelRequest();
  }

  public onCollected(handler: (statistics: { outbound: TOutbound; inbound: TInbound }) => void) {
    this.events.on(COLLECTED_EVENT, handler);
  }

  public offCollected(handler: (statistics: { outbound: TOutbound; inbound: TInbound }) => void) {
    this.events.off(COLLECTED_EVENT, handler);
  }

  private readonly resolveCollectStatistics = (
    peerConnection: RTCPeerConnection,
    {
      onError,
    }: {
      onError?: (error: unknown) => void;
    },
  ) => {
    return () => {
      const startTime = now();

      this.requesterAllStatistics
        .request(peerConnection)
        .then((allStatistics) => {
          this.events.trigger(COLLECTED_EVENT, parseStatsReports(allStatistics));

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

          this.start(peerConnection, {
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
  };
}

export default StatsPeerConnection;
