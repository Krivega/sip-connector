import { resolveRequesterByTimeout } from '@krivega/timeout-requester';

import type { ConnectionManager } from '@/ConnectionManager';
import type { TParametersCheckTelephony } from './types';

class CheckTelephonyRequester {
  private readonly connectionManager: ConnectionManager;

  private readonly interval: number;

  private checkTelephonyByTimeout: ReturnType<typeof resolveRequesterByTimeout> | undefined =
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
    getParameters,
    clearCache,
    onSuccessRequest,
    onFailRequest,
  }: {
    getParameters: () => TParametersCheckTelephony;
    onSuccessRequest: () => void;
    onFailRequest: () => void;
    clearCache?: () => Promise<void>;
  }) {
    this.stop();

    this.checkTelephonyByTimeout = resolveRequesterByTimeout({
      isDontStopOnFail: true,
      requestInterval: this.interval,
      request: async () => {
        if (clearCache) {
          await clearCache();
        }

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
    if (this.checkTelephonyByTimeout) {
      this.checkTelephonyByTimeout.stop();
      this.checkTelephonyByTimeout = undefined;
    }
  }
}

export default CheckTelephonyRequester;
