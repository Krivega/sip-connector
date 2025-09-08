import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';

class RegistrationFailedOutOfCallListener {
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

  public subscribe({ onFailed }: { onFailed: () => void }) {
    this.unsubscribe();

    this.registrationFailedDisposer = this.connectionManager.on('registrationFailed', () => {
      this.subscribeChangeCallStatus(onFailed);
    });
  }

  public unsubscribe() {
    this.unsubscribeRegistrationFailed();
    this.unsubscribeChangeCallStatus();
  }

  private subscribeChangeCallStatus(onFailed: () => void) {
    this.unsubscribeChangeCallStatus();

    this.callStatusDisposer = this.callManager.onChangeCallStatus((isCallActive) => {
      if (!isCallActive) {
        onFailed();
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

export default RegistrationFailedOutOfCallListener;
