import logger from '@/logger';
import { EEvent } from './eventNames';
import { createParametersNotExistError } from './utils';

import type { ConnectionManager } from '@/ConnectionManager';
import type { ConnectionQueueManager } from '@/ConnectionQueueManager';
import type { TEvents } from './eventNames';
import type { TParametersConnect } from './types';

class ConnectFlow {
  private readonly events: TEvents;

  private readonly connectionManager: ConnectionManager;

  private readonly connectionQueueManager: ConnectionQueueManager;

  public constructor({
    events,
    connectionManager,
    connectionQueueManager,
  }: {
    events: TEvents;
    connectionQueueManager: ConnectionQueueManager;
    connectionManager: ConnectionManager;
  }) {
    this.events = events;
    this.connectionManager = connectionManager;
    this.connectionQueueManager = connectionQueueManager;

    this.subscribe();
  }

  public async runDisconnect() {
    return this.connectionQueueManager
      .run(async () => {
        return this.disconnect();
      })
      .catch((error: unknown) => {
        logger('runDisconnect: error', error);
      });
  }

  public async runConnect(
    getConnectParameters: () => Promise<TParametersConnect | undefined>,
    hasReadyForConnection?: () => boolean,
  ) {
    return this.connectionQueueManager.run(async () => {
      return this.connect(getConnectParameters, hasReadyForConnection);
    });
  }

  public stop() {
    this.connectionQueueManager.stop();
  }

  private async disconnect() {
    const isConfigured = this.connectionManager.isConfigured();

    logger('disconnect: isConfigured, ', isConfigured);

    if (isConfigured) {
      return this.connectionManager.disconnect();
    }

    return undefined;
  }

  private async connect(
    getConnectParameters: () => Promise<TParametersConnect | undefined>,
    hasReadyForConnection?: () => boolean,
  ) {
    return this.disconnect()
      .catch((error: unknown) => {
        logger('connect: disconnect error', error);
      })
      .then(async () => {
        logger('connect: then');

        return this.connectWithProcessError(getConnectParameters, hasReadyForConnection);
      });
  }

  private async connectWithProcessError(
    getConnectParameters: () => Promise<TParametersConnect | undefined>,
    hasReadyForConnection?: () => boolean,
  ) {
    const isReadyForConnection = hasReadyForConnection?.() ?? true;

    logger('connectWithProcessError: isReadyForConnection, ', isReadyForConnection);

    if (!isReadyForConnection) {
      return;
    }

    await this.connectToServer(getConnectParameters).catch(async (error: unknown) => {
      const connectToServerError =
        error instanceof Error ? error : new Error('Failed to connect to server');

      logger('connectWithProcessError: error:', connectToServerError);

      return this.disconnect()
        .then(() => {
          throw connectToServerError;
        })
        .catch(() => {
          throw connectToServerError;
        });
    });
  }

  private async connectToServer(
    getConnectParameters: () => Promise<TParametersConnect | undefined>,
  ) {
    try {
      this.events.trigger(EEvent.CONNECTING, undefined);

      const parameters = await getConnectParameters();

      if (!parameters) {
        throw createParametersNotExistError();
      }

      const ua = await this.connectionManager.connect(parameters);

      logger('connectToServer: isConnected');

      this.events.trigger(EEvent.CONNECTED, {
        ua,
        isRegistered: this.connectionManager.isRegistered,
      });
    } catch (error: unknown) {
      this.events.trigger(EEvent.FAILED, error);

      throw error;
    }
  }

  private subscribe() {
    this.connectionManager.on('disconnecting', () => {
      this.events.trigger(EEvent.DISCONNECTING, undefined);
    });

    this.connectionManager.on('disconnected', () => {
      this.events.trigger(EEvent.DISCONNECTED, undefined);
    });
  }
}

export default ConnectFlow;
