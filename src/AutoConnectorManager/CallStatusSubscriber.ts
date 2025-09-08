import AbstractSubscriber from './AbstractSubscriber';

import type { CallManager } from '@/CallManager';

const EVENT_NAMES = ['accepted', 'confirmed', 'ended', 'failed'] as const;

class CallStatusSubscriber extends AbstractSubscriber<boolean> {
  private readonly callManager: CallManager;

  private isCallActive: boolean;

  public constructor({ callManager }: { callManager: CallManager }) {
    super();

    this.callManager = callManager;
    this.isCallActive = callManager.isCallActive;
  }

  public subscribe(callback: (isActive: boolean) => void) {
    this.unsubscribe();

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
