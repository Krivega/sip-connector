import { DelayRequester } from '@krivega/timeout-requester';

import resolveDebug from '@/logger';
import AttemptsState from './AttemptsState';
import CheckTelephonyRequester from './CheckTelephonyRequester';
import PingServerRequester from './PingServerRequester';
import RegistrationFailedOutOfCallSubscriber from './RegistrationFailedOutOfCallSubscriber';
import TelephonyFailPolicy from './TelephonyFailPolicy';

import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type { ConnectionQueueManager } from '@/ConnectionQueueManager';
import type { TEventMap } from './events';
import type { TParametersAutoConnect, TReconnectReason, IAutoConnectorOptions } from './types';

const debug = resolveDebug('AutoConnectorRuntime');

type TStopReason = 'halted' | 'cancelled' | 'failed' | undefined;

type TEmitters = {
  emitStatusChange: ({ isInProgress }: { isInProgress: boolean }) => void;
  emitBeforeAttempt: () => void;
  emitLimitReachedAttempts: () => void;
  emitSuccess: () => void;
  emitStopAttemptsByError: (error: unknown) => void;
  emitCancelledAttempts: (error: unknown) => void;
  emitFailedAllAttempts: (error: Error) => void;
  emitTelephonyCheckFailure: (payload: TEventMap['telephony-check-failure']) => void;
  emitTelephonyCheckEscalated: (payload: TEventMap['telephony-check-escalated']) => void;
};

type TReconnectActions = {
  requestReconnect: (parameters: TParametersAutoConnect, reason: TReconnectReason) => void;
  notifyTelephonyStillConnected: () => void;
};

type TAutoConnectorRuntimeParams = {
  connectionManager: ConnectionManager;
  connectionQueueManager: ConnectionQueueManager;
  callManager: CallManager;
  emitters: TEmitters;
  reconnectActions: TReconnectActions;
  options?: IAutoConnectorOptions;
};

const DEFAULT_TIMEOUT_BETWEEN_ATTEMPTS = 3000;
const DEFAULT_CHECK_TELEPHONY_REQUEST_INTERVAL = 15_000;

export class AutoConnectorRuntime {
  private readonly connectionManager: ConnectionManager;

  private readonly connectionQueueManager: ConnectionQueueManager;

  private readonly checkTelephonyRequester: CheckTelephonyRequester;

  private readonly pingServerRequester: PingServerRequester;

  private readonly registrationFailedOutOfCallSubscriber: RegistrationFailedOutOfCallSubscriber;

  private readonly attemptsState: AttemptsState;

  private readonly delayBetweenAttempts: DelayRequester;

  private readonly telephonyFailPolicy: TelephonyFailPolicy;

  private readonly emitters: TEmitters;

  private readonly reconnectActions: TReconnectActions;

  public constructor(params: TAutoConnectorRuntimeParams) {
    this.connectionManager = params.connectionManager;
    this.connectionQueueManager = params.connectionQueueManager;
    this.emitters = params.emitters;
    this.reconnectActions = params.reconnectActions;

    this.checkTelephonyRequester = new CheckTelephonyRequester({
      connectionManager: this.connectionManager,
      interval:
        params.options?.checkTelephonyRequestInterval ?? DEFAULT_CHECK_TELEPHONY_REQUEST_INTERVAL,
    });
    this.pingServerRequester = new PingServerRequester({
      connectionManager: this.connectionManager,
    });
    this.registrationFailedOutOfCallSubscriber = new RegistrationFailedOutOfCallSubscriber({
      connectionManager: this.connectionManager,
      callManager: params.callManager,
    });
    this.delayBetweenAttempts = new DelayRequester(
      params.options?.timeoutBetweenAttempts ?? DEFAULT_TIMEOUT_BETWEEN_ATTEMPTS,
    );
    this.telephonyFailPolicy = new TelephonyFailPolicy(params.options?.telephonyFailPolicy);
    this.attemptsState = new AttemptsState({
      onStatusChange: this.emitters.emitStatusChange,
    });
  }

  public async stopConnectionFlow() {
    debug('stopConnectionFlow');

    // Важно останавливать локальные циклы до disconnect, чтобы не запускать новые рестарты во время остановки.
    this.stopAttempts();
    this.stopConnectTriggers();
    await this.connectionQueueManager.disconnect();
  }

  public async connect(parameters: TParametersAutoConnect) {
    await this.connectionQueueManager.connect(parameters.getParameters, parameters.options);
  }

  public async delayBeforeRetry() {
    await this.delayBetweenAttempts.request();
  }

  public cancelPendingRetry() {
    this.delayBetweenAttempts.cancelRequest();
  }

  public hasLimitReached() {
    return this.attemptsState.hasLimitReached();
  }

  public shouldDisconnectBeforeAttempt(): boolean {
    const { isDisconnected, isIdle, isDisconnecting, requested } = this.connectionManager;

    if (isDisconnecting || requested) {
      return true;
    }

    return !(isDisconnected || isIdle);
  }

  public beforeAttempt() {
    debug('entryAttemptingGate');
    this.emitters.emitBeforeAttempt();
    this.stopConnectTriggers();
  }

  public beforeConnectAttempt() {
    debug('entryAttemptingConnect');
    this.attemptsState.startAttempt();
    this.attemptsState.increment();
  }

  public onLimitReached(parameters: TParametersAutoConnect) {
    debug('onLimitReachedTransition');
    this.attemptsState.finishAttempt();
    this.emitters.emitLimitReachedAttempts();
    this.startCheckTelephony(parameters);
  }

  public onConnectSucceeded(parameters: TParametersAutoConnect) {
    this.subscribeToConnectTriggers(parameters);
    this.emitters.emitSuccess();
  }

  public emitTerminalOutcome({
    stopReason,
    lastError,
  }: {
    stopReason: TStopReason;
    lastError: unknown;
  }) {
    // Терминальная ветка всегда завершает активную попытку, независимо от причины остановки.
    this.attemptsState.finishAttempt();

    if (stopReason === 'halted') {
      this.emitters.emitStopAttemptsByError(lastError);

      return;
    }

    if (stopReason === 'cancelled') {
      this.emitters.emitCancelledAttempts(lastError);

      return;
    }

    if (stopReason === 'failed') {
      this.emitters.emitFailedAllAttempts(lastError as Error);

      return;
    }

    debug('emitTerminalOutcome without stopReason', lastError);
  }

  public onTelephonyStillConnected() {
    debug('onTelephonyStillConnected');
    this.stopConnectTriggers();
    this.emitters.emitSuccess();
  }

  public stopConnectTriggers() {
    debug('stopConnectTriggers');

    this.pingServerRequester.stop();
    this.checkTelephonyRequester.stop();
    this.registrationFailedOutOfCallSubscriber.unsubscribe();
  }

  private stopAttempts() {
    if (this.attemptsState.isAttemptInProgress) {
      this.connectionQueueManager.stop();
    }

    this.cancelPendingRetry();
    this.attemptsState.reset();
  }

  private startCheckTelephony(parameters: TParametersAutoConnect) {
    debug('startCheckTelephony');

    this.checkTelephonyRequester.start(
      async () => {
        return parameters.getParameters();
      },
      {
        onSuccessRequest: () => {
          debug('startCheckTelephony: onSuccessRequest');
          this.telephonyFailPolicy.reset();

          if (this.isConnectionUnavailable()) {
            this.reconnectActions.requestReconnect(parameters, 'telephony-disconnected');
          } else {
            this.reconnectActions.notifyTelephonyStillConnected();
          }
        },
        onFailRequest: (error?: unknown) => {
          const decision = this.telephonyFailPolicy.registerFailure();

          // Ошибка check-telephony не переводит state machine в другой state,
          // а только эмитит метрики и по policy может запросить reconnect.
          this.emitters.emitTelephonyCheckFailure({
            failCount: decision.failCount,
            escalationLevel: decision.escalationLevel,
            shouldRequestReconnect: decision.shouldRequestReconnect,
            nextRetryDelayMs: decision.nextRetryDelayMs,
            error,
          });

          if (decision.escalationLevel !== 'none' && decision.hasEscalated) {
            this.emitters.emitTelephonyCheckEscalated({
              failCount: decision.failCount,
              escalationLevel: decision.escalationLevel,
              error,
            });
          }

          if (decision.shouldRequestReconnect) {
            this.reconnectActions.requestReconnect(parameters, 'telephony-check-failed');
          }

          debug('startCheckTelephony: onFailRequest', (error as Error | undefined)?.message);
        },
      },
    );
  }

  private subscribeToConnectTriggers(parameters: TParametersAutoConnect) {
    // Периодически шлём SIP OPTIONS (`connectionManager.ping`) через тот же JsSIP UA, пока подключены:
    // проверяем живость сигнализации и даём исходящий трафик по WebSocket — в том числе во время активного звонка
    // (раньше пинг заглушался на время звонка). При падении транспорта JsSIP перезапускает сокет; рестарт
    // автоконнектора по одному сбою ping не вешаем — не дублируем встроенное переподключение транспорта.
    /**
     * Периодический SIP OPTIONS (`connectionManager.ping`) по установленному UA.
     * Работает независимо от того, идёт ли звонок: поддерживает трафик по WebSocket
     * и проверяет живость сигнализации в фоне всегда, пока автоконнектор в режиме
     * «подписан на триггеры» после успешного connect.
     */
    this.pingServerRequester.start({
      onFailRequest: () => {
        debug('pingRequester: onFailRequest');
      },
    });

    this.registrationFailedOutOfCallSubscriber.subscribe(() => {
      debug('registrationFailedOutOfCallListener callback');
      this.reconnectActions.requestReconnect(parameters, 'registration-failed-out-of-call');
    });
  }

  private isConnectionUnavailable() {
    const { isDisconnected, isIdle } = this.connectionManager;

    return isDisconnected || isIdle;
  }
}
