import type { CallManager } from '@/CallManager';

class NotActiveCallSubscriber {
  private readonly callManager: CallManager;

  private disposers: (() => void)[] = [];

  public constructor({ callManager }: { callManager: CallManager }) {
    this.callManager = callManager;
  }

  public subscribe({ onActive, onInactive }: { onActive: () => void; onInactive: () => void }) {
    this.unsubscribe();

    if (!this.callManager.isCallActive) {
      onInactive();
    }

    this.disposers.push(
      this.callManager.on('call-status-changed', ({ isCallActive }) => {
        if (isCallActive) {
          onActive();
        } else {
          onInactive();
        }
      }),
    );
  }

  public unsubscribe() {
    this.disposers.forEach((disposer) => {
      disposer();
    });
    this.disposers = [];
  }
}

export default NotActiveCallSubscriber;
