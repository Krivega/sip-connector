import { TypedEvents } from 'events-constructor';

import resolveDebug from '@/logger';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type PingServerRequester from './PingServerRequester';

const SIGNALING_CHECK_TIMEOUT = 15_000;

const EVENT_NAMES = ['ping-succeeded', 'stopped'] as const;

type TEventMap = {
  'ping-succeeded': never;
  stopped: never;
};

const debug = resolveDebug('AutoConnectorManager: CallSignalingRecovery');

// JsSIP отклоняет OPTIONS с `originator: 'remote'`, только когда сервер ответил не-2xx
const hasServerResponded = (error: unknown): boolean => {
  return error instanceof Object && 'originator' in error && error.originator === 'remote';
};

class CallSignalingRecovery {
  private readonly connectionManager: ConnectionManager;

  private readonly callManager: CallManager;

  private readonly pingServerRequester: PingServerRequester;

  private readonly onSignalingUnstable: ({ failCount }: { failCount: number }) => void;

  private readonly onSignalingRestored: () => void;

  private readonly events = new TypedEvents<TEventMap>(EVENT_NAMES);

  private unsubscribeTransportConnected: (() => void) | undefined = undefined;

  private signalingCheck: Promise<boolean> | undefined = undefined;

  private isSignalingUnstable = false;

  private isPingOnTransportConnectedPending = false;

  public constructor({
    connectionManager,
    callManager,
    pingServerRequester,
    onSignalingUnstable,
    onSignalingRestored,
  }: {
    connectionManager: ConnectionManager;
    callManager: CallManager;
    pingServerRequester: PingServerRequester;
    onSignalingUnstable: ({ failCount }: { failCount: number }) => void;
    onSignalingRestored: () => void;
  }) {
    this.connectionManager = connectionManager;
    this.callManager = callManager;
    this.pingServerRequester = pingServerRequester;
    this.onSignalingUnstable = onSignalingUnstable;
    this.onSignalingRestored = onSignalingRestored;
  }

  // Re-INVITE в зависший WebSocket JsSIP завершает звонок, поэтому сначала сигнализацию подтверждает ping
  public async waitForSignaling(): Promise<boolean> {
    if (!this.pingServerRequester.isStarted || !this.callManager.isCallActive) {
      return true;
    }

    this.signalingCheck ??= this.checkSignaling().finally(() => {
      this.signalingCheck = undefined;
    });

    return this.signalingCheck;
  }

  public onPingSucceeded() {
    this.isPingOnTransportConnectedPending = false;
    this.restoreSignaling();
    this.events.trigger('ping-succeeded');
    this.callManager.renegotiateIfPending().catch((error: unknown) => {
      debug('renegotiateIfPending: failed', error);
    });
  }

  public onPingFailedInCall({ failCount, error }: { failCount: number; error: unknown }) {
    const isPingOnTransportConnected = this.isPingOnTransportConnectedPending;

    this.isPingOnTransportConnectedPending = false;

    if (!this.isSignalingUnstable) {
      this.isSignalingUnstable = true;
      this.onSignalingUnstable({ failCount });
    }

    // Транспорт доставил ответ сервера: переоткрытие ничего не восстановит
    if (hasServerResponded(error)) {
      debug('skip reopen transport: server responded');

      return;
    }

    // Переоткрытие уже не помогло (например, сервер отвечает 408): следующее — только по провалу периодического ping
    if (isPingOnTransportConnected) {
      debug('skip reopen transport: ping on reconnected transport failed');

      return;
    }

    this.pingOnTransportConnected();
    this.connectionManager.reopenTransport();
  }

  public stop() {
    debug('stop');
    this.unsubscribeTransportConnected?.();
    this.unsubscribeTransportConnected = undefined;
    this.isPingOnTransportConnectedPending = false;
    this.events.trigger('stopped');
    this.restoreSignaling();
  }

  // Ping уходит через общий цикл: его провал, как и любой другой, сообщает `signaling-unstable` и восстанавливает транспорт
  private async checkSignaling(): Promise<boolean> {
    const pingSuccess = this.waitForPingSuccess(SIGNALING_CHECK_TIMEOUT);

    this.pingServerRequester.pingImmediately();

    return pingSuccess;
  }

  private async waitForPingSuccess(timeout: number): Promise<boolean> {
    const unsubscribers: (() => void)[] = [];

    return new Promise<boolean>((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(false);
      }, timeout);

      unsubscribers.push(
        () => {
          clearTimeout(timeoutId);
        },
        this.events.onceRace(['ping-succeeded', 'stopped'], (_data, eventName) => {
          resolve(eventName === 'ping-succeeded');
        }),
        this.callManager.onceRace(['ended', 'failed'], () => {
          resolve(false);
        }),
      );
    }).finally(() => {
      unsubscribers.forEach((unsubscribe) => {
        unsubscribe();
      });
    });
  }

  private restoreSignaling() {
    if (!this.isSignalingUnstable) {
      return;
    }

    this.isSignalingUnstable = false;
    this.onSignalingRestored();
  }

  // Ping по переподключённому транспорту уходит сразу, не дожидаясь интервала
  private pingOnTransportConnected() {
    this.unsubscribeTransportConnected ??= this.connectionManager.once('connected', () => {
      debug('transport connected: ping immediately');
      this.unsubscribeTransportConnected = undefined;
      this.isPingOnTransportConnectedPending = true;
      this.pingServerRequester.pingImmediately();
    });
  }
}

export default CallSignalingRecovery;
