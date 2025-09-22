import { CancelableRequest } from '@krivega/cancelable-promise';
import { resolveRequesterByTimeout } from '@krivega/timeout-requester';

import type { ConnectionManager } from '@/ConnectionManager';
import type { TParametersCheckTelephony } from './types';

class CheckTelephonyRequester {
  private readonly connectionManager: ConnectionManager;

  private readonly interval: number;

  private checkTelephonyByTimeout: ReturnType<typeof resolveRequesterByTimeout> | undefined =
    undefined;

  private cancelableBeforeRequest: CancelableRequest<void, TParametersCheckTelephony> | undefined =
    undefined;

  public constructor({
    connectionManager,
    interval,
  }: {
    connectionManager: ConnectionManager;
    interval: number;
  }) {
    this.connectionManager = connectionManager;
    this.interval = interval;
  }

  public start({
    onBeforeRequest,
    onSuccessRequest,
    onFailRequest,
  }: {
    onBeforeRequest: () => Promise<TParametersCheckTelephony>;
    onSuccessRequest: () => void;
    onFailRequest: () => void;
  }) {
    this.stop();

    this.cancelableBeforeRequest = new CancelableRequest(onBeforeRequest);

    this.checkTelephonyByTimeout = resolveRequesterByTimeout({
      isDontStopOnFail: true,
      requestInterval: this.interval,
      request: async () => {
        if (!this.cancelableBeforeRequest) {
          throw new Error('cancelableBeforeRequest is not defined');
        }

        const parameters = await this.cancelableBeforeRequest.request();

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
    if (this.checkTelephonyByTimeout) {
      this.checkTelephonyByTimeout.stop();
      this.checkTelephonyByTimeout = undefined;
    }

    if (this.cancelableBeforeRequest) {
      this.cancelableBeforeRequest.cancelRequest();
      this.cancelableBeforeRequest = undefined;
    }
  }
}

export default CheckTelephonyRequester;
