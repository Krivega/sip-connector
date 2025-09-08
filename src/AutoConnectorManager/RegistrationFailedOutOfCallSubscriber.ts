import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { ISubscriber } from './types';

class RegistrationFailedOutOfCallSubscriber implements ISubscriber {
  private readonly connectionManager: ConnectionManager;

  private readonly callManager: CallManager;

  private registrationFailedDisposer?: () => void;

  private callStatusDisposer?: () => void;

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

    this.registrationFailedDisposer = this.connectionManager.on('registrationFailed', () => {
      this.subscribeChangeCallStatus(callback);
    });
  }

  public unsubscribe() {
    this.unsubscribeRegistrationFailed();
    this.unsubscribeChangeCallStatus();
  }

  private subscribeChangeCallStatus(callback: () => void) {
    this.unsubscribeChangeCallStatus();

    this.callStatusDisposer = this.callManager.onChangeCallStatus((isCallActive) => {
      if (!isCallActive) {
        callback();
      }
    });
  }

  private unsubscribeChangeCallStatus() {
    this.callStatusDisposer?.();
    this.callStatusDisposer = undefined;
  }

  private unsubscribeRegistrationFailed() {
    this.registrationFailedDisposer?.();
    this.registrationFailedDisposer = undefined;
  }
}

export default RegistrationFailedOutOfCallSubscriber;
