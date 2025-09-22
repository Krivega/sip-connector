import { CancelableRequest } from '@krivega/cancelable-promise';
import { resolveRequesterByTimeout } from '@krivega/timeout-requester';

import type { ConnectionManager } from '@/ConnectionManager';
import type { TParametersCheckTelephony } from './types';

class CheckTelephonyRequester {
  private readonly connectionManager: ConnectionManager;

  private readonly cancelableBeforeRequest: CancelableRequest<void, void>;

  private readonly interval: number;

  private checkTelephonyByTimeout: ReturnType<typeof resolveRequesterByTimeout> | undefined =
    undefined;

  public constructor({
    connectionManager,
    interval,
    onBeforeRequest,
  }: {
    connectionManager: ConnectionManager;
    interval: number;
    onBeforeRequest: () => Promise<void>;
  }) {
    this.connectionManager = connectionManager;
    this.interval = interval;

    this.cancelableBeforeRequest = new CancelableRequest(onBeforeRequest);
  }

  public start({
    getParameters,
    onSuccessRequest,
    onFailRequest,
  }: {
    getParameters: () => Promise<TParametersCheckTelephony>;
    onSuccessRequest: () => void;
    onFailRequest: () => void;
  }) {
    this.stop();

    this.checkTelephonyByTimeout = resolveRequesterByTimeout({
      isDontStopOnFail: true,
      requestInterval: this.interval,
      request: async () => {
        await this.cancelableBeforeRequest.request();

        const parameters = await getParameters();

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
    this.cancelableBeforeRequest.cancelRequest();

    if (this.checkTelephonyByTimeout) {
      this.checkTelephonyByTimeout.stop();
      this.checkTelephonyByTimeout = undefined;
    }
  }
}

export default CheckTelephonyRequester;
