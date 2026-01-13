import { CancelableRequest } from '@krivega/cancelable-promise';
import lodash from 'lodash';

import logger from '@/logger';

import type { CallManager } from '@/CallManager';
import type { TMainStreamRecovery } from './types';

const DEFAULT_THROTTLE_RECOVERY_TIMEOUT_MS = 3000;

class MainStreamRecovery implements TMainStreamRecovery {
  private readonly renegotiateRequester: CancelableRequest<void, boolean>;

  private readonly renegotiateThrottled: (() => void) & { cancel: () => void };

  public constructor(
    callManager: CallManager,
    throttleRecoveryTimeout: number = DEFAULT_THROTTLE_RECOVERY_TIMEOUT_MS,
  ) {
    this.renegotiateRequester = new CancelableRequest(callManager.renegotiate.bind(callManager));
    this.renegotiateThrottled = lodash.throttle(
      this.requestRenegotiate.bind(this),
      throttleRecoveryTimeout,
    );
  }

  public recover(): void {
    logger('trying to recover main stream');

    this.renegotiateThrottled();
  }

  public cancel() {
    logger('cancel recover main stream');

    this.renegotiateThrottled.cancel();
    this.renegotiateRequester.cancelRequest();
  }

  private readonly requestRenegotiate = () => {
    this.renegotiateRequester.cancelRequest();

    logger('trying to renegotiate');

    this.renegotiateRequester
      .request()
      .then(() => {
        logger('renegotiate has successful');
      })
      .catch((error: unknown) => {
        logger('failed to renegotiate main media stream', error);
      });
  };
}

export default MainStreamRecovery;
