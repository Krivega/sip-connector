import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { ISubscriber } from './types';

class RegistrationFailedOutOfCallSubscriber implements ISubscriber {
  private readonly connectionManager: ConnectionManager;

  private readonly callManager: CallManager;

  private isRegistrationFailed = false;

  private disposers: (() => void)[] = [];

  public constructor({
    connectionManager,
    callManager,
  }: {
    connectionManager: ConnectionManager;
    callManager: CallManager;
  }) {
    this.connectionManager = connectionManager;

    this.callManager = callManager;
  }

  public subscribe(callback: () => void) {
    this.unsubscribe();

    this.disposers.push(
      this.connectionManager.on('registrationFailed', () => {
        this.setIsRegistrationFailed();
      }),
    );

    this.disposers.push(
      this.callManager.on('call-status-changed', ({ isCallActive }) => {
        if (!isCallActive && this.isRegistrationFailed) {
          callback();
        }
      }),
    );
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
