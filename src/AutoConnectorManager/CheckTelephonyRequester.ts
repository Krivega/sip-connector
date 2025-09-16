import { CancelableRequest } from '@krivega/cancelable-promise';
import { resolveRequesterByTimeout } from '@krivega/timeout-requester';

import type { ConnectionManager } from '@/ConnectionManager';
import type { TParametersCheckTelephony } from './types';

class CheckTelephonyRequester {
  private readonly connectionManager: ConnectionManager;

  private readonly cancelableRequestClearCache: CancelableRequest<void, void>;

  private readonly interval: number;

  private checkTelephonyByTimeout: ReturnType<typeof resolveRequesterByTimeout> | undefined =
    undefined;

  public constructor({
    connectionManager,
    interval,
    clearCache,
  }: {
    connectionManager: ConnectionManager;
    interval: number;
    clearCache: () => Promise<void>;
  }) {
    this.connectionManager = connectionManager;
    this.interval = interval;

    this.cancelableRequestClearCache = new CancelableRequest(clearCache);
  }

  public start({
    getParameters,
    onSuccessRequest,
    onFailRequest,
  }: {
    getParameters: () => TParametersCheckTelephony;
    onSuccessRequest: () => void;
    onFailRequest: () => void;
  }) {
    this.stop();

    this.checkTelephonyByTimeout = resolveRequesterByTimeout({
      isDontStopOnFail: true,
      requestInterval: this.interval,
      request: async () => {
        await this.cancelableRequestClearCache.request();

        const parameters = getParameters();

        return this.connectionManager.checkTelephony(parameters);
      },
    });

    this.checkTelephonyByTimeout.start(undefined, {
      onFailRequest,
      onSuccessRequest: () => {
        this.stop();
        onSuccessRequest();
      },
    });
  }

  public stop() {
    this.cancelableRequestClearCache.cancelRequest();

    if (this.checkTelephonyByTimeout) {
      this.checkTelephonyByTimeout.stop();
      this.checkTelephonyByTimeout = undefined;
    }
  }
}

export default CheckTelephonyRequester;
