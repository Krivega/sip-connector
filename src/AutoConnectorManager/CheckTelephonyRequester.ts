import { resolveRequesterByTimeout } from '@krivega/timeout-requester';

import logger from '@/logger';

import type { ConnectionManager } from '@/ConnectionManager';

export type TParametersCheckTelephony = Parameters<ConnectionManager['checkTelephony']>[0];
export type TOptionsCheckTelephony = {
  interval: number;
  onBeforeRequest?: () => Promise<void>;
};

const noop = async () => {};

class CheckTelephonyRequester {
  private readonly connectionManager: ConnectionManager;

  private readonly checkTelephonyByTimeout: ReturnType<typeof resolveRequesterByTimeout>;

  private request = noop;

  public constructor({
    connectionManager,
    interval,
  }: {
    connectionManager: ConnectionManager;
    interval: number;
  }) {
    this.connectionManager = connectionManager;

    this.checkTelephonyByTimeout = resolveRequesterByTimeout({
      isDontStopOnFail: true,
      requestInterval: interval,
      request: this.request,
    });
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
    this.request = async () => {
      if (clearCache) {
        await clearCache();
      }

      const parameters = getParameters();

      return this.connectionManager.checkTelephony(parameters);
    };

    this.checkTelephonyByTimeout.start(undefined, {
      onFailRequest: (error: unknown) => {
        logger('check telephony: error - ', (error as Error).message);

        onFailRequest();
      },
      onSuccessRequest: () => {
        logger('check telephony: success');

        this.stop();
        onSuccessRequest();
      },
    });
  }

  public stop() {
    this.checkTelephonyByTimeout.stop();
  }
}

export default CheckTelephonyRequester;
