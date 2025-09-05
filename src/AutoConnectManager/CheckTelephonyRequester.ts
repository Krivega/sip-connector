import { resolveRequesterByTimeout } from '@krivega/timeout-requester';

import type { ConnectionManager } from '@/ConnectionManager';

export type TParametersCheckTelephony = Parameters<ConnectionManager['checkTelephony']>[0];
export type TOptionsCheckTelephony = {
  interval: number;
  onBeforeRequest?: () => Promise<void>;
};

const DEFAULT_INTERVAL = 15_000;
const noop = async () => {};

class CheckTelephonyRequester {
  private readonly connectionManager: ConnectionManager;

  private readonly checkTelephonyByTimeout: ReturnType<typeof resolveRequesterByTimeout>;

  private request = noop;

  private interval: number = DEFAULT_INTERVAL;

  public constructor({ connectionManager }: { connectionManager: ConnectionManager }) {
    this.connectionManager = connectionManager;

    this.checkTelephonyByTimeout = resolveRequesterByTimeout({
      isDontStopOnFail: true,
      requestInterval: this.interval,
      request: this.request,
    });
  }

  public start({
    options,
    getParameters,
  }: {
    options: TOptionsCheckTelephony;
    getParameters: () => TParametersCheckTelephony;
  }) {
    this.interval = options.interval;

    this.request = async () => {
      return options.onBeforeRequest?.().then(async () => {
        const parameters = getParameters();

        return this.connectionManager.checkTelephony(parameters);
      });
    };

    this.checkTelephonyByTimeout.start(undefined);
  }

  public stop() {
    this.checkTelephonyByTimeout.stop();
  }
}

export default CheckTelephonyRequester;
