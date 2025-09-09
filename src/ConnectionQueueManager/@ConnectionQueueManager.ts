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

  public register: ConnectionManager['register'] = async () => {
    return this.stackPromises.run(async () => {
      return this.connectionManager.register();
    }) as ReturnType<ConnectionManager['register']>;
  };

  public unregister: ConnectionManager['unregister'] = async () => {
    return this.stackPromises.run(async () => {
      return this.connectionManager.unregister();
    }) as ReturnType<ConnectionManager['unregister']>;
  };

  public tryRegister: ConnectionManager['tryRegister'] = async () => {
    return this.stackPromises.run(async () => {
      return this.connectionManager.tryRegister();
    }) as ReturnType<ConnectionManager['tryRegister']>;
  };

  public stop() {
    this.stackPromises.stop();
  }
}

export default ConnectionQueueManager;
