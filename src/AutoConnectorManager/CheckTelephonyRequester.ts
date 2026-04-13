import { CancelableRequest } from '@krivega/cancelable-promise';
import { resolveRequesterByTimeout } from '@krivega/timeout-requester';

import type { ConnectionManager } from '@/ConnectionManager';
import type { TParametersCheckTelephony } from './types';

class CheckTelephonyRequester {
  private readonly connectionManager: ConnectionManager;

  private readonly interval: number;

  private checkTelephonyByTimeout: ReturnType<typeof resolveRequesterByTimeout> | undefined =
    undefined;

  private cancelableGetParameters: CancelableRequest<void, TParametersCheckTelephony> | undefined =
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

  public start(
    getParameters: () => Promise<TParametersCheckTelephony>,
    {
      onSuccessRequest,
      onFailRequest,
    }: {
      onSuccessRequest: () => void;
      onFailRequest: () => void;
    },
  ) {
    this.stop();

    this.cancelableGetParameters = new CancelableRequest(getParameters);

    this.checkTelephonyByTimeout = resolveRequesterByTimeout({
      isDontStopOnFail: true,
      requestInterval: this.interval,
      request: async () => {
        if (!this.cancelableGetParameters) {
          throw new Error('cancelableGetParameters is not defined');
        }

        const parameters = await this.cancelableGetParameters.request();

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
    this.checkTelephonyByTimeout?.stop();
    this.checkTelephonyByTimeout = undefined;

    this.cancelableGetParameters?.cancelRequest();
    this.cancelableGetParameters = undefined;
  }
}

export default CheckTelephonyRequester;
