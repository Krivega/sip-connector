import { CancelableRequest } from '@krivega/cancelable-promise';
import lodash from 'lodash';

import logger from '@/logger';

import type { CallManager } from '@/CallManager';

const DEFAULT_THROTTLE_RECOVERY_TIMEOUT_MS = 3000;

class MainStreamRecovery {
  private readonly renegotiateRequester: CancelableRequest<void, boolean>;

  private readonly renegotiateThrottled: (() => void) & { cancel: () => void };

  private readonly callManager: CallManager;

  public constructor(
    callManager: CallManager,
    throttleRecoveryTimeout: number = DEFAULT_THROTTLE_RECOVERY_TIMEOUT_MS,
  ) {
    this.callManager = callManager;
    this.renegotiateRequester = new CancelableRequest(callManager.renegotiate.bind(callManager));
    this.renegotiateThrottled = lodash.throttle(
      this.requestRenegotiate.bind(this),
      throttleRecoveryTimeout,
    );

    this.subscribe();
  }

  public recover(): void {
    logger('trying to recover main stream');

    this.renegotiateThrottled();
  }

  private readonly requestRenegotiate = () => {
    if (this.renegotiateRequester.requested) {
      logger('stopped: previous renegotiate is not finished yet');

      return;
    }

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

  private subscribe() {
    this.callManager.on('ended', () => {
      this.cancel();
    });
  }

  private cancel() {
    logger('cancel recover main stream');

    this.renegotiateThrottled.cancel();
    this.renegotiateRequester.cancelRequest();
  }
}

export default MainStreamRecovery;
