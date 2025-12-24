import type { CallManager } from '@/CallManager';

class NotActiveCallSubscriber {
  private readonly callManager: CallManager;

  private disposers: (() => void)[] = [];

  public constructor({ callManager }: { callManager: CallManager }) {
    this.callManager = callManager;
  }

  public subscribe(parameters: { onActive?: () => void; onInactive: () => void }) {
    this.unsubscribe();

    this.disposers.push(
      this.callManager.on('call-status-changed', () => {
        this.handleCallStatusChange(parameters);
      }),
    );

    this.handleCallStatusChange(parameters);
  }

  public unsubscribe() {
    this.disposers.forEach((disposer) => {
      disposer();
    });
    this.disposers = [];
  }

  private handleCallStatusChange({
    onActive,
    onInactive,
  }: {
    onActive?: () => void;
    onInactive: () => void;
  }) {
    if (this.callManager.isCallActive) {
      onActive?.();
    } else {
      onInactive();
    }
  }
}

export default NotActiveCallSubscriber;
