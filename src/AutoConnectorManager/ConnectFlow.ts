import logger from '@/logger';
import { EEvent } from './eventNames';

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

  public async runConnect({
    onBeforeRequest,
    hasReadyForConnection,
  }: {
    onBeforeRequest: () => Promise<TParametersConnect>;
    hasReadyForConnection?: () => boolean;
  }) {
    return this.connectionQueueManager.run(async () => {
      return this.connect(onBeforeRequest, hasReadyForConnection);
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
    onBeforeRequest: () => Promise<TParametersConnect>,
    hasReadyForConnection?: () => boolean,
  ) {
    return this.disconnect()
      .catch((error: unknown) => {
        logger('connect: disconnect error', error);
      })
      .then(async () => {
        logger('connect: then');

        return this.connectWithProcessError(onBeforeRequest, hasReadyForConnection);
      });
  }

  private async connectWithProcessError(
    onBeforeRequest: () => Promise<TParametersConnect>,
    hasReadyForConnection?: () => boolean,
  ) {
    const isReadyForConnection = hasReadyForConnection?.() ?? true;

    logger('connectWithProcessError: isReadyForConnection, ', isReadyForConnection);

    if (!isReadyForConnection) {
      return;
    }

    await this.connectToServer(onBeforeRequest).catch(async (error: unknown) => {
      logger('connectWithProcessError: error:', error);

      return this.disconnect()
        .then(() => {
          throw error as Error;
        })
        .catch(() => {
          throw error as Error;
        });
    });
  }

  private async connectToServer(onBeforeRequest: () => Promise<TParametersConnect>) {
    try {
      this.events.trigger(EEvent.CONNECTING, {});

      const parameters = await onBeforeRequest();

      const ua = await this.connectionManager.connect(parameters);

      logger('connectToServer: isConnected');

      this.events.trigger(EEvent.CONNECTED, {
        ua,
        isRegistered: this.connectionManager.isRegistered,
      });
    } catch (error: unknown) {
      const connectError =
        error instanceof Error ? error : new Error('Failed to connect to server');

      this.events.trigger(EEvent.FAILED, connectError);

      throw connectError;
    }
  }

  private subscribe() {
    this.connectionManager.on('disconnecting', () => {
      this.events.trigger(EEvent.DISCONNECTING, {});
    });

    this.connectionManager.on('disconnected', () => {
      this.events.trigger(EEvent.DISCONNECTED, {});
    });
  }
}

export default ConnectFlow;
