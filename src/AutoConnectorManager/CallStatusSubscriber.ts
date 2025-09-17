import AbstractSubscriber from './AbstractSubscriber';

import type { CallManager } from '@/CallManager';

const EVENT_NAMES = ['accepted', 'confirmed', 'ended', 'failed'] as const;

class CallStatusSubscriber extends AbstractSubscriber<boolean> {
  private readonly callManager: CallManager;

  private isCallActive = false;

  public constructor({ callManager }: { callManager: CallManager }) {
    super();

    this.callManager = callManager;
  }

  public subscribe(callback: (isActive: boolean) => void, options?: { fireImmediately?: boolean }) {
    this.unsubscribe();

    this.isCallActive = this.callManager.isCallActive;

    if (options?.fireImmediately === true) {
      callback(this.isCallActive);
    }

    const disposers = EVENT_NAMES.map((eventName) => {
      return this.callManager.on(eventName, () => {
        this.handleChangeCallStatus(callback);
      });
    });

    this.disposer = () => {
      disposers.forEach((disposer) => {
        disposer();
      });
    };
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
