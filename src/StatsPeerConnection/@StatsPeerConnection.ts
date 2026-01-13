import { CancelableRequest } from '@krivega/cancelable-promise';
import { SetTimeoutRequest } from '@krivega/timeout-requester';

import log from '@/logger';
import { INTERVAL_COLLECT_STATISTICS } from './constants';
import { createEvents } from './events';
import parseStatsReports from './parseStatsReports';
import requestAllStatistics from './requestAllStatistics';
import { now } from './utils';

import type { TEventMap, TEvents } from './events';

const debug = (data: unknown) => {
  log(String(data));
};

class StatsPeerConnection {
  public readonly events: TEvents;

  private readonly setTimeoutRequest: SetTimeoutRequest;

  private readonly requesterAllStatistics = new CancelableRequest<
    RTCPeerConnection,
    ReturnType<typeof requestAllStatistics>
  >(requestAllStatistics);

  public constructor() {
    this.events = createEvents();
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
    this.stop();
    this.setTimeoutRequest.request(() => {
      this.collectStatistics(peerConnection, {
        onError,
      });
    }, interval);
  }

  public stop() {
    this.setTimeoutRequest.cancelRequest();
    this.requesterAllStatistics.cancelRequest();
  }

  public on<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.events.on(eventName, handler);
  }

  public once<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.events.once(eventName, handler);
  }

  public onceRace<T extends keyof TEventMap>(
    eventNames: T[],
    handler: (data: TEventMap[T], eventName: string) => void,
  ) {
    return this.events.onceRace(eventNames, handler);
  }

  public async wait<T extends keyof TEventMap>(eventName: T): Promise<TEventMap[T]> {
    return this.events.wait(eventName);
  }

  public off<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    this.events.off(eventName, handler);
  }

  private readonly collectStatistics = (
    peerConnection: RTCPeerConnection,
    {
      onError,
    }: {
      onError?: (error: unknown) => void;
    },
  ) => {
    const startTime = now();

    this.requesterAllStatistics
      .request(peerConnection)
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
}

export default StatsPeerConnection;
