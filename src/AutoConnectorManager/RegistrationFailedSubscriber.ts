import AbstractSubscriber from './AbstractSubscriber';

import type { ConnectionManager } from '@/ConnectionManager';

class RegistrationFailedSubscriber extends AbstractSubscriber {
  private readonly connectionManager: ConnectionManager;

  public constructor({ connectionManager }: { connectionManager: ConnectionManager }) {
    super();

    this.connectionManager = connectionManager;
  }

  public subscribe(callback: () => void) {
    this.unsubscribe();

    this.disposer = this.connectionManager.on('registrationFailed', callback);
  }
}

export default RegistrationFailedSubscriber;
