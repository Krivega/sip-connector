import CallStatusSubscriber from './CallStatusSubscriber';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { ISubscriber } from './types';

class RegistrationFailedOutOfCallSubscriber implements ISubscriber {
  private readonly callStatusSubscriber: CallStatusSubscriber;

  private readonly connectionManager: ConnectionManager;

  private isRegistrationFailed = false;

  private disposeRegistrationFailed: (() => void) | undefined;

  public constructor({
    connectionManager,
    callManager,
  }: {
    connectionManager: ConnectionManager;
    callManager: CallManager;
  }) {
    this.connectionManager = connectionManager;

    this.callStatusSubscriber = new CallStatusSubscriber({ callManager });
  }

  public subscribe(callback: () => void) {
    this.unsubscribe();

    this.disposeRegistrationFailed = this.connectionManager.on('registrationFailed', () => {
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
    this.unsubscribeRegistrationFailed();
    this.resetIsRegistrationFailed();
  }

  private setIsRegistrationFailed() {
    this.isRegistrationFailed = true;
  }

  private resetIsRegistrationFailed() {
    this.isRegistrationFailed = false;
  }

  private unsubscribeRegistrationFailed() {
    this.disposeRegistrationFailed?.();
    this.disposeRegistrationFailed = undefined;
  }
}

export default RegistrationFailedOutOfCallSubscriber;
