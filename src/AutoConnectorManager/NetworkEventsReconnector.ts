import resolveDebug from '@/logger';

import type { INetworkEventsSubscriber, TParametersAutoConnect, TReconnectReason } from './types';

const debug = resolveDebug('NetworkEventsReconnector');

const DEFAULT_OFFLINE_GRACE_MS = 2000;

const REASON_NETWORK_ONLINE: TReconnectReason = 'network-online';
const REASON_NETWORK_CHANGE: TReconnectReason = 'network-change';

type TNetworkEventsReconnectorParameters = {
  subscriber: INetworkEventsSubscriber;
  offlineGraceMs?: number;
  // Разделение ответственности: этот модуль только слушает сетевые события и
  // дёргает две операции менеджера. Бизнес-логика (coalescing, stateMachine)
  // остаётся в AutoConnectorManager.
  requestReconnect: (parameters: TParametersAutoConnect, reason: TReconnectReason) => void;
  stopConnection: () => void;
};

class NetworkEventsReconnector {
  private readonly subscriber: INetworkEventsSubscriber;

  private readonly offlineGraceMs: number;

  private readonly requestReconnect: TNetworkEventsReconnectorParameters['requestReconnect'];

  private readonly stopConnection: TNetworkEventsReconnectorParameters['stopConnection'];

  private parameters: TParametersAutoConnect | undefined;

  private offlineTimer: ReturnType<typeof setTimeout> | undefined;

  private isSubscribed = false;

  public constructor({
    subscriber,
    offlineGraceMs,
    requestReconnect,
    stopConnection,
  }: TNetworkEventsReconnectorParameters) {
    this.subscriber = subscriber;
    this.offlineGraceMs = offlineGraceMs ?? DEFAULT_OFFLINE_GRACE_MS;
    this.requestReconnect = requestReconnect;
    this.stopConnection = stopConnection;
  }

  public start(parameters: TParametersAutoConnect) {
    this.parameters = parameters;

    if (this.isSubscribed) {
      return;
    }

    this.subscriber.subscribe({
      onChange: this.handleChange,
      onOnline: this.handleOnline,
      onOffline: this.handleOffline,
    });
    this.isSubscribed = true;
  }

  public setParameters(parameters: TParametersAutoConnect) {
    this.parameters = parameters;
  }

  public stop() {
    this.cancelOfflineTimer();

    if (!this.isSubscribed) {
      return;
    }

    this.subscriber.unsubscribe();
    this.isSubscribed = false;
    this.parameters = undefined;
  }

  private readonly handleOnline = () => {
    debug('network online');
    this.cancelOfflineTimer();
    this.requestReconnectIfAvailable(REASON_NETWORK_ONLINE);
  };

  private readonly handleChange = () => {
    debug('network change');
    this.cancelOfflineTimer();
    this.requestReconnectIfAvailable(REASON_NETWORK_CHANGE);
  };

  private readonly handleOffline = () => {
    debug('network offline, scheduling disconnect', { graceMs: this.offlineGraceMs });
    this.cancelOfflineTimer();

    this.offlineTimer = setTimeout(() => {
      this.offlineTimer = undefined;
      debug('network offline grace window elapsed, stopping active connection');
      this.stopConnection();
    }, this.offlineGraceMs);
  };

  private requestReconnectIfAvailable(reason: TReconnectReason) {
    if (!this.parameters) {
      debug('skipping reconnect: no parameters', { reason });

      return;
    }

    this.requestReconnect(this.parameters, reason);
  }

  private cancelOfflineTimer() {
    if (this.offlineTimer !== undefined) {
      clearTimeout(this.offlineTimer);
      this.offlineTimer = undefined;
    }
  }
}

export default NetworkEventsReconnector;
