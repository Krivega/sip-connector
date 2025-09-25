import { createStackPromises } from 'stack-promises';

import type { ConnectionManager } from '@/ConnectionManager';

class ConnectionQueueManager {
  private readonly connectionManager: ConnectionManager;

  private readonly stackPromises = createStackPromises<unknown>({
    noRunIsNotActual: true,
  });

  public constructor({ connectionManager }: { connectionManager: ConnectionManager }) {
    this.connectionManager = connectionManager;
  }

  public connect: ConnectionManager['connect'] = async (...args) => {
    return this.stackPromises.run(async () => {
      return this.connectionManager.connect(...args);
    }) as ReturnType<ConnectionManager['connect']>;
  };

  public disconnect: ConnectionManager['disconnect'] = async () => {
    return this.stackPromises.run(async () => {
      return this.connectionManager.disconnect();
    }) as ReturnType<ConnectionManager['disconnect']>;
  };

  public stop() {
    this.stackPromises.stop();
  }
}

export default ConnectionQueueManager;
