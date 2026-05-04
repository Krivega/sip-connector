import { EventEmitterProxy } from 'events-constructor';

import resolveDebug from '@/logger';
import { AutoConnectorRuntime } from './AutoConnectorRuntime';
import { createAutoConnectorStateMachine } from './AutoConnectorStateMachine';
import { baseCanRetryOnError } from './baseCanRetryOnError';
import { createBrowserNetworkEventsSubscriber } from './createBrowserNetworkEventsSubscriber';
import { createMachineDeps } from './createMachineDeps';
import { createEvents } from './events';
import NetworkEventsReconnector from './NetworkEventsReconnector';
import ReconnectRequestCoalescer from './ReconnectRequestCoalescer';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { ConnectionQueueManager } from '@/ConnectionQueueManager';
import type { AutoConnectorStateMachine } from './AutoConnectorStateMachine';
import type { TEventMap } from './events';
import type {
  IAutoConnectorOptions,
  TAutoConnectStartResult,
  TParametersAutoConnect,
  TReconnectReason,
} from './types';

const RECONNECT_COALESCE_WINDOW_MS = 250;

const ERROR_MESSAGES = {
  LIMIT_REACHED: 'Limit reached',
} as const;

const debug = resolveDebug('AutoConnectorManager');
const START_REASON: TReconnectReason = 'start';
const MANUAL_RESTART_REASON: TReconnectReason = 'manual-restart';

class AutoConnectorManager extends EventEmitterProxy<TEventMap> {
  public readonly stateMachine: AutoConnectorStateMachine;

  private readonly runtime: AutoConnectorRuntime;

  private readonly connectionManager: ConnectionManager;

  private readonly reconnectCoalescer = new ReconnectRequestCoalescer({
    coalesceWindowMs: RECONNECT_COALESCE_WINDOW_MS,
  });

  private readonly networkEventsReconnector: NetworkEventsReconnector | undefined;

  public constructor(
    {
      connectionQueueManager,
      connectionManager,
      callManager,
    }: {
      connectionQueueManager: ConnectionQueueManager;
      connectionManager: ConnectionManager;
      callManager: CallManager;
    },
    options?: IAutoConnectorOptions,
  ) {
    super(createEvents());

    this.connectionManager = connectionManager;

    this.runtime = new AutoConnectorRuntime({
      connectionManager,
      connectionQueueManager,
      callManager,
      options,
      emitters: {
        emitBeforeAttempt: () => {
          this.events.trigger('before-attempt', {});
        },
        emitLimitReachedAttempts: () => {
          this.events.trigger('limit-reached-attempts', new Error(ERROR_MESSAGES.LIMIT_REACHED));
        },
        emitSuccess: () => {
          debug('handleSucceededAttempt');
          this.events.trigger('success');
        },
        emitStopAttemptsByError: (error: unknown) => {
          this.events.trigger('stop-attempts-by-error', error);
        },
        emitCancelledAttempts: (error: unknown) => {
          this.events.trigger('cancelled-attempts', error);
        },
        emitFailedAllAttempts: (error: Error) => {
          this.events.trigger('failed-all-attempts', error);
        },
        emitTelephonyCheckFailure: (payload) => {
          this.events.trigger('telephony-check-failure', payload);
        },
        emitTelephonyCheckEscalated: (payload) => {
          this.events.trigger('telephony-check-escalated', payload);
        },
        emitStatusChange: ({ isInProgress }: { isInProgress: boolean }) => {
          this.events.trigger('changed-attempt-status', { isInProgress });
        },
      },
      reconnectActions: {
        requestReconnect: this.requestReconnect,
        notifyTelephonyStillConnected: () => {
          this.stateMachine.toTelephonyResultStillConnected();
        },
      },
    });

    this.stateMachine = createAutoConnectorStateMachine(
      createMachineDeps({
        baseCanRetryOnError,
        runtime: this.runtime,
        canRetryOnError: options?.canRetryOnError,
      }),
    );

    const networkEventsSubscriber =
      options?.networkEventsSubscriber ?? createBrowserNetworkEventsSubscriber();

    if (networkEventsSubscriber) {
      this.networkEventsReconnector = new NetworkEventsReconnector({
        subscriber: networkEventsSubscriber,
        offlineGraceMs: options?.offlineGraceMs,
        onChangePolicy: options?.onNetworkChangePolicy,
        onOnlinePolicy: options?.onNetworkOnlinePolicy,
        probe: this.probeServerReachability,
        requestReconnect: this.requestReconnect,
        stopConnection: () => {
          // Только прерываем текущее соединение; подписка на сетевые события остаётся
          // активной, чтобы вернуть флоу при последующем online/change.
          this.stateMachine.toStop();
        },
      });
    }
  }

  public async start(parameters: TParametersAutoConnect): Promise<TAutoConnectStartResult> {
    debug('auto connector start');

    if (this.isStarted()) {
      debug(
        'auto connector start skipped: already started. Use restart() for force reconnect or stop() before next start()',
      );

      return {
        isSuccess: false,
        reason: 'coalesced',
      };
    }

    const isRequested = this.requestReconnect(parameters, START_REASON);

    if (!isRequested) {
      return {
        isSuccess: false,
        reason: 'coalesced',
      };
    }

    this.networkEventsReconnector?.start(parameters);

    return new Promise<TAutoConnectStartResult>((resolve) => {
      const unsubscribe = this.events.onceRace(
        ['success', 'failed-all-attempts', 'stop-attempts-by-error', 'limit-reached-attempts'],
        (payload, eventName) => {
          unsubscribe();

          if (eventName === 'success') {
            resolve({
              isSuccess: true,
              reason: 'started',
            });

            return;
          }

          if (eventName === 'failed-all-attempts') {
            resolve({
              isSuccess: false,
              reason: 'failed-all-attempts',
              error: payload,
            });

            return;
          }

          if (eventName === 'stop-attempts-by-error') {
            resolve({
              isSuccess: false,
              reason: 'stop-attempts-by-error',
              error: payload,
            });

            return;
          }

          resolve({
            isSuccess: false,
            reason: 'limit-reached-attempts',
            error: payload,
          });
        },
      );
    });
  }

  public restart() {
    debug('auto connector restart');

    const { parameters } = this.stateMachine.context;

    if (!parameters) {
      debug('auto connector restart skipped: no parameters in context');

      return;
    }

    this.requestReconnect(parameters, MANUAL_RESTART_REASON);
  }

  public stop() {
    debug('auto connector stop');

    this.networkEventsReconnector?.stop();
    this.resetReconnectCoalescingState();
    this.stateMachine.toStop();
  }

  // Test hook: allows deterministic cancellation of pending retry flow.
  public cancelPendingRetry() {
    this.runtime.cancelPendingRetry();
  }

  private readonly requestReconnect = (
    parameters: TParametersAutoConnect,
    reason: TReconnectReason,
  ): boolean => {
    const isAvailableToRestart = this.shouldRequestReconnect(reason);

    debug('auto connector requestReconnect', {
      isAvailableToRestart,
      reason,
    });

    if (!isAvailableToRestart) {
      return false;
    }

    // Держим последние валидные параметры в подписчике сетевых событий, чтобы
    // на onOnline/onChange не зависеть от текущего состояния state machine.
    this.networkEventsReconnector?.setParameters(parameters);
    this.stateMachine.toRestart(parameters);

    return true;
  };

  // Адаптивный probe под состояние машины. Возвращаемое значение трактуется
  // вызывающей стороной единообразно: `true` — reconnect не нужен, `false` —
  // нужен. Но смысл самой проверки отличается:
  //
  // * `connectedMonitoring`: дешёвый SIP OPTIONS (`ping`) по уже установленному
  //    сокету. Успех → сокет жив (true). Неуспех → сокет мёртв (false).
  //
  // * `waitingBeforeRetry`: мы ждём `timeoutBetweenAttempts`. Проверяем
  //    сервер через `checkTelephony` (временное подключение). Доступен →
  //    ускоряем попытку (false = "нужен reconnect"); недоступен → не тратим
  //    попытку впустую, ждём естественный retry (true).
  //
  // * В прочих состояниях probe бесполезен (попытка либо уже идёт, либо нет
  //    параметров): возвращаем false, сохраняя прежнее поведение — пусть
  //    сетевое событие триггернёт стандартный `requestReconnect`.
  private readonly probeServerReachability = async (): Promise<boolean> => {
    if (this.stateMachine.isInConnectedMonitoringState()) {
      debug('probeServerReachability: isInConnectedMonitoringState');

      try {
        await this.connectionManager.ping();

        return true;
      } catch (error) {
        debug('probeServerReachability: ping failed', error);

        return false;
      }
    }

    if (this.stateMachine.isInWaitingBeforeRetryState()) {
      debug('probeServerReachability: isInWaitingBeforeRetryState');

      const { parameters } = this.stateMachine.context;

      try {
        const checkTelephonyParameters = await parameters.getParameters();

        await this.connectionManager.checkTelephony(checkTelephonyParameters);

        // Сервер отвечает — имеет смысл немедленно попытаться переподключиться.
        return false;
      } catch (error) {
        debug('probeServerReachability: checkTelephony failed', error);

        // Сервер недоступен — не расходуем попытку зря, пусть отработает штатный retry.
        return true;
      }
    }

    debug('probeServerReachability: default return false');

    return false;
  };

  private shouldRequestReconnect(reason: TReconnectReason) {
    const decision = this.reconnectCoalescer.register(reason);

    if (!decision.shouldRequest) {
      debug(`auto connector reconnect coalesced: ${reason}`, {
        state: String(this.stateMachine.state),
        coalescedBy: decision.coalescedBy,
        currentPriority: decision.currentPriority,
        coalescedByPriority: decision.coalescedByPriority,
      });

      return false;
    }

    debug(`auto connector reconnect requested: ${reason}`, {
      state: String(this.stateMachine.state),
      generation: decision.generation,
    });

    return true;
  }

  private resetReconnectCoalescingState() {
    this.reconnectCoalescer.reset();
  }

  private isStarted(): boolean {
    return !this.stateMachine.isInIdleState();
  }
}

export default AutoConnectorManager;
