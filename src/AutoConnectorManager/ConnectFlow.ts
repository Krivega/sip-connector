import { hasPromiseIsNotActualError, type ConnectionQueueManager } from '@/ConnectionQueueManager';
import logger from '@/logger';

import type { TParametersConnect } from './types';

class ConnectFlow {
  private readonly connectionQueueManager: ConnectionQueueManager;

  private readonly hasConfigured: () => boolean;

  public constructor({
    connectionQueueManager,
    hasConfigured,
  }: {
    connectionQueueManager: ConnectionQueueManager;
    hasConfigured: () => boolean;
  }) {
    this.connectionQueueManager = connectionQueueManager;

    this.hasConfigured = hasConfigured;
  }

  public async runDisconnect() {
    const isConfigured = this.hasConfigured();

    logger('runDisconnect: isConfigured, ', isConfigured);

    if (isConfigured) {
      return this.connectionQueueManager.disconnect();
    }

    return undefined;
  }

  public async runConnect(parameters: TParametersConnect, hasReadyForConnection?: () => boolean) {
    return this.runDisconnect()
      .catch((error: unknown) => {
        logger('runConnect: disconnect catch', error);
      })
      .then(async () => {
        logger('runConnect: disconnect then');

        return this.connectWithProcessError(parameters, hasReadyForConnection);
      });
  }

  public stop() {
    this.connectionQueueManager.stop();
  }

  private async connectWithProcessError(
    parameters: TParametersConnect,
    hasReadyForConnection?: () => boolean,
  ) {
    const isReadyForConnection = hasReadyForConnection?.() ?? true;

    logger('connectWithProcessError: isReadyForConnection, ', isReadyForConnection);

    if (!isReadyForConnection) {
      return;
    }

    await this.connectionQueueManager
      .connect(parameters)
      .then((isConnected) => {
        logger('connect, isConnected', isConnected);
      })
      .catch(async (error: unknown) => {
        if (hasPromiseIsNotActualError(error)) {
          throw error;
        }

        const connectToServerError =
          error instanceof Error ? error : new Error('Failed to connect to server');

        logger('connectWithProcessError, error:', error);

        return this.runDisconnect()
          .then(() => {
            throw connectToServerError;
          })
          .catch(() => {
            throw connectToServerError;
          });
      });
  }
}

export default ConnectFlow;
