import logger from '@/logger';

import type { DelayRequester } from '@krivega/timeout-requester';
import type { ConnectionManager } from '@/ConnectionManager';
import type { ConnectionQueueManager } from '@/ConnectionQueueManager';
import type AttemptsState from './AttemptsState';
import type CheckTelephonyRequester from './CheckTelephonyRequester';
import type { TEventMap } from './events';
import type PingServerIfNotActiveCallRequester from './PingServerIfNotActiveCallRequester';
import type RegistrationFailedOutOfCallSubscriber from './RegistrationFailedOutOfCallSubscriber';
import type TelephonyFailPolicy from './TelephonyFailPolicy';
import type { TParametersAutoConnect, TReconnectReason } from './types';

type TStopReason = 'halted' | 'cancelled' | 'failed' | undefined;

type TEmitters = {
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
  requestFlowRestart: () => void;
  notifyTelephonyStillConnected: () => void;
};

type TAutoConnectorRuntimeParams = {
  connectionManager: ConnectionManager;
  connectionQueueManager: ConnectionQueueManager;
  checkTelephonyRequester: CheckTelephonyRequester;
  pingServerIfNotActiveCallRequester: PingServerIfNotActiveCallRequester;
  registrationFailedOutOfCallSubscriber: RegistrationFailedOutOfCallSubscriber;
  attemptsState: AttemptsState;
  delayBetweenAttempts: DelayRequester;
  telephonyFailPolicy: TelephonyFailPolicy;
  emitters: TEmitters;
  reconnectActions: TReconnectActions;
};

export class AutoConnectorRuntime {
  private readonly connectionManager: ConnectionManager;

  private readonly connectionQueueManager: ConnectionQueueManager;

  private readonly checkTelephonyRequester: CheckTelephonyRequester;

  private readonly pingServerIfNotActiveCallRequester: PingServerIfNotActiveCallRequester;

  private readonly registrationFailedOutOfCallSubscriber: RegistrationFailedOutOfCallSubscriber;

  private readonly attemptsState: AttemptsState;

  private readonly delayBetweenAttempts: DelayRequester;

  private readonly telephonyFailPolicy: TelephonyFailPolicy;

  private readonly emitters: TEmitters;

  private readonly reconnectActions: TReconnectActions;

  public constructor(params: TAutoConnectorRuntimeParams) {
    this.connectionManager = params.connectionManager;
    this.connectionQueueManager = params.connectionQueueManager;
    this.checkTelephonyRequester = params.checkTelephonyRequester;
    this.pingServerIfNotActiveCallRequester = params.pingServerIfNotActiveCallRequester;
    this.registrationFailedOutOfCallSubscriber = params.registrationFailedOutOfCallSubscriber;
    this.attemptsState = params.attemptsState;
    this.delayBetweenAttempts = params.delayBetweenAttempts;
    this.telephonyFailPolicy = params.telephonyFailPolicy;
    this.emitters = params.emitters;
    this.reconnectActions = params.reconnectActions;
  }

  public async stopConnectionFlow() {
    logger('stopConnectionFlow');

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

  public beforeAttempt() {
    logger('entryAttemptingGate');
    this.emitters.emitBeforeAttempt();
    this.stopConnectTriggers();
  }

  public beforeConnectAttempt() {
    logger('entryAttemptingConnect');
    this.attemptsState.startAttempt();
    this.attemptsState.increment();
  }

  public onLimitReached(parameters: TParametersAutoConnect) {
    logger('onLimitReachedTransition');
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

    logger('emitTerminalOutcome without stopReason', lastError);
  }

  public onTelephonyStillConnected() {
    logger('onTelephonyStillConnected');
    this.stopConnectTriggers();
    this.emitters.emitSuccess();
  }

  public stopConnectTriggers() {
    logger('stopConnectTriggers');

    this.pingServerIfNotActiveCallRequester.stop();
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
    logger('startCheckTelephony');

    this.checkTelephonyRequester.start(
      async () => {
        return parameters.getParameters();
      },
      {
        onSuccessRequest: () => {
          logger('startCheckTelephony: onSuccessRequest');
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

          logger('startCheckTelephony: onFailRequest', (error as Error | undefined)?.message);
        },
      },
    );
  }

  private subscribeToConnectTriggers(parameters: TParametersAutoConnect) {
    this.pingServerIfNotActiveCallRequester.start({
      onFailRequest: () => {
        logger('pingRequester: onFailRequest');
        this.reconnectActions.requestFlowRestart();
      },
    });

    this.registrationFailedOutOfCallSubscriber.subscribe(() => {
      logger('registrationFailedOutOfCallListener callback');
      this.reconnectActions.requestReconnect(parameters, 'registration-failed-out-of-call');
    });
  }

  private isConnectionUnavailable() {
    const { isDisconnected, isIdle } = this.connectionManager;

    return isDisconnected || isIdle;
  }
}
