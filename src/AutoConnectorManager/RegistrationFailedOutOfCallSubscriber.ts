import AbstractSubscriber from './AbstractSubscriber';
import CallStatusSubscriber from './CallStatusSubscriber';
import RegistrationFailedSubscriber from './RegistrationFailedSubscriber';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';

class RegistrationFailedOutOfCallSubscriber extends AbstractSubscriber {
  private readonly callStatusSubscriber: CallStatusSubscriber;

  private readonly registrationFailedSubscriber: RegistrationFailedSubscriber;

  private isRegistrationFailed = false;

  public constructor({
    connectionManager,
    callManager,
  }: {
    connectionManager: ConnectionManager;
    callManager: CallManager;
  }) {
    super();

    this.callStatusSubscriber = new CallStatusSubscriber({ callManager });
    this.registrationFailedSubscriber = new RegistrationFailedSubscriber({ connectionManager });
  }

  public subscribe(callback: () => void) {
    this.unsubscribe();

    this.registrationFailedSubscriber.subscribe(() => {
      this.setIsRegistrationFailed();
    });

    this.callStatusSubscriber.subscribe((isCallActive) => {
      if (!isCallActive && this.isRegistrationFailed) {
        callback();
      }
    });
  }

  public unsubscribe() {
    this.callStatusSubscriber.unsubscribe();
    this.registrationFailedSubscriber.unsubscribe();
    this.resetIsRegistrationFailed();
  }

  private setIsRegistrationFailed() {
    this.isRegistrationFailed = true;
  }

  private resetIsRegistrationFailed() {
    this.isRegistrationFailed = false;
  }
}

export default RegistrationFailedOutOfCallSubscriber;
