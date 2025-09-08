import AbstractSubscriber from './AbstractSubscriber';
import CallStatusSubscriber from './CallStatusSubscriber';
import RegistrationFailedSubscriber from './RegistrationFailedSubscriber';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';

class RegistrationFailedOutOfCallSubscriber extends AbstractSubscriber {
  private readonly callStatusSubscriber: CallStatusSubscriber;

  private readonly registrationFailedSubscriber: RegistrationFailedSubscriber;

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
      this.callStatusSubscriber.subscribe((isCallActive) => {
        if (!isCallActive) {
          callback();
        }
      });
    });
  }

  public unsubscribe() {
    this.callStatusSubscriber.unsubscribe();
    this.registrationFailedSubscriber.unsubscribe();
  }
}

export default RegistrationFailedOutOfCallSubscriber;
