import NotActiveCallSubscriber from './NotActiveCallSubscriber';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { ISubscriber } from './types';

class RegistrationFailedOutOfCallSubscriber implements ISubscriber {
  private readonly connectionManager: ConnectionManager;

  private isRegistrationFailed = false;

  private disposers: (() => void)[] = [];

  private readonly notActiveCallSubscriber: NotActiveCallSubscriber;

  public constructor({
    connectionManager,
    callManager,
  }: {
    connectionManager: ConnectionManager;
    callManager: CallManager;
  }) {
    this.connectionManager = connectionManager;

    this.notActiveCallSubscriber = new NotActiveCallSubscriber({ callManager });
  }

  public subscribe(callback: () => void) {
    this.unsubscribe();

    this.disposers.push(
      this.connectionManager.on('registrationFailed', () => {
        this.setIsRegistrationFailed();
      }),
    );

    this.notActiveCallSubscriber.subscribe({
      onInactive: () => {
        if (this.isRegistrationFailed) {
          callback();
        }
      },
    });

    this.disposers.push(() => {
      this.notActiveCallSubscriber.unsubscribe();
    });
  }

  public unsubscribe() {
    this.disposers.forEach((disposer) => {
      disposer();
    });
    this.disposers = [];

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
