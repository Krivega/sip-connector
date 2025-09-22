import type { CallManager } from '@/CallManager';
import type { ISubscriber } from './types';

const EVENT_NAMES = ['accepted', 'confirmed', 'ended', 'failed'] as const;

class CallStatusSubscriber implements ISubscriber<boolean> {
  private readonly callManager: CallManager;

  private isCallActive = false;

  private disposer?: () => void;

  public constructor({ callManager }: { callManager: CallManager }) {
    this.callManager = callManager;
  }

  public subscribe(callback: (isActive: boolean) => void, options?: { fireImmediately?: boolean }) {
    this.unsubscribe();

    this.isCallActive = this.callManager.isCallActive;

    if (options?.fireImmediately === true) {
      callback(this.isCallActive);
    }

    this.subscribeToCallStatusChanges(callback);
  }

  public unsubscribe() {
    this.disposer?.();
    this.disposer = undefined;
  }

  private subscribeToCallStatusChanges(callback: (isActive: boolean) => void) {
    this.disposer = this.callManager.onceRace([...EVENT_NAMES], () => {
      this.handleChangeCallStatus(callback);

      this.subscribeToCallStatusChanges(callback);
    });
  }

  private handleChangeCallStatus(callback: (isActive: boolean) => void) {
    const newStatus = this.callManager.isCallActive;

    if (newStatus !== this.isCallActive) {
      this.isCallActive = newStatus;

      callback(newStatus);
    }
  }
}

export default CallStatusSubscriber;
