import resolveDebug from '@/logger';

import type {
  INetworkEventsSubscriber,
  TNetworkEventPolicy,
  TNetworkProbe,
  TParametersAutoConnect,
  TReconnectReason,
} from './types';

const debug = resolveDebug('NetworkEventsReconnector');

// Даём сети "поморгать" без немедленного disconnect.
const DEFAULT_OFFLINE_GRACE_MS = 2000;
// По умолчанию делаем мягкую проверку доступности сервера перед reconnect.
const DEFAULT_POLICY: TNetworkEventPolicy = 'probe';

const REASON_NETWORK_ONLINE: TReconnectReason = 'network-online';
const REASON_NETWORK_CHANGE: TReconnectReason = 'network-change';

type TNetworkEventsReconnectorParameters = {
  subscriber: INetworkEventsSubscriber;
  offlineGraceMs?: number;
  onChangePolicy?: TNetworkEventPolicy;
  onOnlinePolicy?: TNetworkEventPolicy;
  // Если `probe` не передан, политика 'probe' деградирует до 'reconnect'
  // (безопасный дефолт, сохраняющий прежнее поведение).
  probe?: TNetworkProbe;
  // Разделение ответственности: этот модуль только слушает сетевые события и
  // дёргает операции менеджера. Бизнес-логика (coalescing, stateMachine)
  // остаётся в AutoConnectorManager.
  requestReconnect: (parameters: TParametersAutoConnect, reason: TReconnectReason) => void;
  stopConnection: () => void;
};

class NetworkEventsReconnector {
  private readonly subscriber: INetworkEventsSubscriber;

  private readonly offlineGraceMs: number;

  private readonly onChangePolicy: TNetworkEventPolicy;

  private readonly onOnlinePolicy: TNetworkEventPolicy;

  private readonly probe: TNetworkProbe | undefined;

  private readonly requestReconnect: TNetworkEventsReconnectorParameters['requestReconnect'];

  private readonly stopConnection: TNetworkEventsReconnectorParameters['stopConnection'];

  private parameters: TParametersAutoConnect | undefined;

  private offlineTimer: ReturnType<typeof setTimeout> | undefined;

  private isSubscribed = false;

  // Guard от параллельных probe-вызовов: если сетевых событий прилетело
  // несколько подряд, достаточно одной проверки, результат применим ко всем.
  private isProbeInFlight = false;

  public constructor({
    subscriber,
    offlineGraceMs,
    onChangePolicy,
    onOnlinePolicy,
    probe,
    requestReconnect,
    stopConnection,
  }: TNetworkEventsReconnectorParameters) {
    this.subscriber = subscriber;
    this.offlineGraceMs = offlineGraceMs ?? DEFAULT_OFFLINE_GRACE_MS;
    this.onChangePolicy = onChangePolicy ?? DEFAULT_POLICY;
    this.onOnlinePolicy = onOnlinePolicy ?? DEFAULT_POLICY;
    this.probe = probe;
    this.requestReconnect = requestReconnect;
    this.stopConnection = stopConnection;
  }

  public start(parameters: TParametersAutoConnect) {
    this.parameters = parameters;

    if (this.isSubscribed) {
      return;
    }

    // Подписка единоразовая на жизненный цикл менеджера (до stop()).
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
    debug('network online', { policy: this.onOnlinePolicy });
    // Если сеть восстановилась быстро, отменяем отложенный offline-stop.
    this.cancelOfflineTimer();
    this.applyPolicy(this.onOnlinePolicy, REASON_NETWORK_ONLINE);
  };

  private readonly handleChange = () => {
    debug('network change', { policy: this.onChangePolicy });
    // Важно: onChange не отменяет offline-grace таймер.
    // Сеть может "переключаться", пока браузер остаётся offline; в этом случае
    // нельзя сбрасывать pending disconnect.
    this.applyPolicy(this.onChangePolicy, REASON_NETWORK_CHANGE);
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

  private applyPolicy(policy: TNetworkEventPolicy, reason: TReconnectReason): void {
    if (policy === 'ignore') {
      debug('policy=ignore, skipping', { reason });

      return;
    }

    if (policy === 'reconnect' || !this.probe) {
      // Либо явно requested reconnect, либо не передан probe — откатываемся
      // к старому безопасному поведению "всегда reconnect".
      this.requestReconnectIfAvailable(reason);

      return;
    }

    if (this.isProbeInFlight) {
      debug('probe already in flight, skipping duplicate', { reason });

      return;
    }

    this.isProbeInFlight = true;

    this.probe()
      .then((isReachable) => {
        debug('probe result', { reason, isReachable });

        if (!isReachable) {
          // Сервер недоступен на новой сети -> перезапускаем connect flow.
          this.requestReconnectIfAvailable(reason);
        }
      })
      .catch((error: unknown) => {
        debug('probe threw, requesting reconnect', { reason, error });
        this.requestReconnectIfAvailable(reason);
      })
      .finally(() => {
        this.isProbeInFlight = false;
      });
  }

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
