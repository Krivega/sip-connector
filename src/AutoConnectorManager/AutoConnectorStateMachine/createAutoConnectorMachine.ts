import { isCanceledError } from '@krivega/cancelable-promise';
import { hasCanceledError } from '@krivega/timeout-requester';
import { assign, fromPromise, setup } from 'xstate';

import { hasNotReadyForConnectionError } from '@/ConnectionManager';
import { hasConnectionPromiseIsNotActualError } from '@/ConnectionQueueManager';
import logger from '@/logger';
import { getInvokeError } from './getInvokeError';
import { AUTO_CONNECTOR_STATE_IDS } from './types';

import type { EAutoConnectorState, TAutoConnectorContext, TAutoConnectorEvent } from './types';
import type { TParametersAutoConnect } from '../types';

const debug = (message: string, ...args: unknown[]) => {
  logger(`[AutoConnectorMachine] ${message}`, ...args);
};

/**
 * Внешние зависимости машины автоподключения: реализуются в `AutoConnectorManager`, чтобы машина
 * оставалась декларативной. Экспортируемый фабричный метод — `createAutoConnectorMachine`.
 */
type TAutoConnectorMachineDeps = {
  /** Правило из опций: можно ли переподключаться после этой ошибки. */
  canRetryOnError: (error: unknown) => boolean;
  /** Полная остановка текущего флоу: сброс попыток, стоп триггеров, `disconnect` очереди. */
  stopConnectionFlow: () => Promise<void>;
  /** Один вызов `connectionQueueManager.connect` с параметрами из контекста. */
  connect: (parameters: TParametersAutoConnect) => Promise<void>;
  /** Ожидание `timeoutBetweenAttempts` перед следующей попыткой. */
  delayBetweenAttempts: () => Promise<void>;
  /** Колбэк `onBeforeRetry` перед повторной попыткой (после задержки). */
  onBeforeRetryRequest: () => Promise<void>;
  /** Достигнут ли лимит попыток подряд (`AttemptsState`). */
  hasLimitReached: () => boolean;
  /** Событие `before-attempt` наружу. */
  emitBeforeAttempt: () => void;
  /** Остановка ping, check-telephony, registration-failed подписок. */
  stopConnectTriggers: () => void;
  /** Пометить попытку как начатую (статус «в процессе»). */
  startAttempt: () => void;
  /** Увеличить счётчик попыток. */
  incrementAttempt: () => void;
  /** Завершить попытку (снять флаг «в процессе»). */
  finishAttempt: () => void;
  /** Событие `limit-reached-attempts`. */
  emitLimitReachedAttempts: () => void;
  /** Запуск периодической проверки телефонии после лимита. */
  startCheckTelephony: () => void;
  /** Успешный `connect`: подписки на мониторинг и `success`. */
  onConnectSucceeded: () => void;
  /** Ошибка без ретрая: `stop-attempts-by-error`. */
  onStopAttemptsByError: (error: unknown) => void;
  /** Отмена с передачей исходной ошибки (например «неактуальный» промис). */
  emitCancelledAttemptsRaw: (error: unknown) => void;
  /** Отмена с нормализацией ошибки в `Error` (цепочка задержки / beforeRetry). */
  emitCancelledAttemptsWrapped: (error: unknown) => void;
  /** Исчерпание попыток после ошибки в цепочке ретрая: `failed-all-attempts`. */
  onFailedAllAttempts: (error: unknown) => void;
  /** Уже подключены: остановить триггеры и `success` (ветка check-telephony). */
  onTelephonyStillConnected: () => void;
};

/** Начальный контекст до первого `AUTO.RESTART`. */
const initialContext = (): TAutoConnectorContext => {
  return {
    parameters: undefined,
    afterDisconnect: 'idle',
    stopReason: undefined,
    lastError: undefined,
  };
};

type TStopRestartTransitions = {
  'AUTO.STOP': { target: EAutoConnectorState; actions: 'assignStop' };
  'AUTO.RESTART': { target: EAutoConnectorState; actions: 'assignRestart' };
};

const withStopAndRestart = (
  target: EAutoConnectorState = AUTO_CONNECTOR_STATE_IDS.DISCONNECTING,
): TStopRestartTransitions => {
  return {
    'AUTO.STOP': {
      target,
      actions: 'assignStop' as const,
    },
    'AUTO.RESTART': {
      target,
      actions: 'assignRestart' as const,
    },
  };
};

const withStopRestartAndFlowRestart = (
  target: EAutoConnectorState = AUTO_CONNECTOR_STATE_IDS.DISCONNECTING,
) => {
  return {
    ...withStopAndRestart(target),
    'FLOW.RESTART': {
      target,
      actions: 'assignFlowRestart' as const,
    },
  };
};

/**
 * Собирает машину `autoConnector`: состояния, гварды, invoke-акторы и действия.
 *
 * @param deps — колбэки из менеджера; см. описание полей у `TAutoConnectorMachineDeps`.
 */
export const createAutoConnectorMachine = (deps: TAutoConnectorMachineDeps) => {
  return setup({
    types: {
      context: {} as TAutoConnectorContext,
      events: {} as TAutoConnectorEvent,
    },
    /** Асинхронные шаги: остановка флоу, коннект, задержка + beforeRetry. */
    actors: {
      /** Invoke при входе в `disconnecting`: единый «срез» текущего подключения. */
      stopConnectionFlow: fromPromise(async () => {
        debug('stopConnectionFlow');
        await deps.stopConnectionFlow();
      }),
      /** Invoke в `attemptingConnect`: реальный SIP/WebSocket connect. */
      connect: fromPromise(async ({ input }: { input: TParametersAutoConnect }) => {
        debug('connect', input);
        await deps.connect(input);
      }),
      /** Invoke в `waitingBeforeRetry`: сначала задержка между попытками, затем `onBeforeRetry`. */
      waitBeforeRetry: fromPromise(async () => {
        debug('waitBeforeRetry');
        await deps.delayBetweenAttempts();
        await deps.onBeforeRetryRequest();
      }),
    },
    /** Условия переходов после `disconnect`, классификация ошибок `connect` и ретрая. */
    guards: {
      /** После `stopConnectionFlow` уходим в `idle` (полная остановка / ошибка остановки). */
      shouldGoIdleAfterDisconnect: ({ context }) => {
        return context.afterDisconnect === 'idle';
      },
      /** После `stopConnectionFlow` продолжаем цикл: к шлюзу попытки. */
      shouldAttemptAfterDisconnect: ({ context }) => {
        return context.afterDisconnect === 'attempt';
      },
      /** Лимит попыток исчерпан — переход к режиму check-telephony. */
      isLimitReached: () => {
        return deps.hasLimitReached();
      },
      /** Ошибка «ещё не готовы к подключению» — без ретрая. */
      isNotReadyForConnection: ({ event }) => {
        return hasNotReadyForConnectionError(getInvokeError(event));
      },
      /** Политика опций запрещает повтор для этой ошибки. */
      isNoRetryPolicy: ({ event }) => {
        return !deps.canRetryOnError(getInvokeError(event));
      },
      /** Промис коннекта снят очередью (`stack-promises`) — отмена попыток. */
      isNotActualPromise: ({ event }) => {
        return hasConnectionPromiseIsNotActualError(getInvokeError(event));
      },
      /** Отмена задержки или `onBeforeRetry` (cancelable / timeout-requester). */
      isWaitRetryCancelled: ({ event }) => {
        const error = getInvokeError(event);

        return isCanceledError(error) || hasCanceledError(error as Error);
      },
    },
    /** Синхронные побочные эффекты и обновление контекста (`assign`). */
    actions: {
      /** Лог при падении invoke `stopConnectionFlow` при рестарте. */
      logRestartFailed: ({ event }) => {
        debug('auto connector failed to restart connection attempts:', getInvokeError(event));
      },
      /** Сохранить параметры подключения и намерение продолжить попытки после `disconnect`. */
      assignRestart: assign({
        parameters: ({ event }) => {
          return (event as { type: 'AUTO.RESTART'; parameters: TParametersAutoConnect }).parameters;
        },
        afterDisconnect: () => {
          return 'attempt' as const;
        },
        stopReason: () => {
          return undefined;
        },
        lastError: () => {
          return undefined;
        },
      }),
      /** Рестарт мониторинга без смены `parameters` (ping / внутренний перезапуск). */
      assignFlowRestart: assign({
        afterDisconnect: 'attempt' as const,
        stopReason: () => {
          return undefined;
        },
        lastError: () => {
          return undefined;
        },
      }),
      /** Пользовательский или внешний стоп: после `disconnect` уйти в `idle`. */
      assignStop: assign({
        afterDisconnect: 'idle' as const,
        stopReason: () => {
          return undefined;
        },
        lastError: () => {
          return undefined;
        },
      }),
      /** Начало цикла попытки: событие «перед попыткой» и сброс внешних триггеров. */
      entryAttemptingGate: () => {
        debug('entryAttemptingGate');
        deps.emitBeforeAttempt();
        deps.stopConnectTriggers();
      },
      /** Учёт попытки в `AttemptsState` непосредственно перед `connect`. */
      entryAttemptingConnect: () => {
        debug('entryAttemptingConnect');
        deps.startAttempt();
        deps.incrementAttempt();
      },
      /** Лимит: завершить попытку, событие лимита, запуск опроса телефонии. */
      onLimitReachedTransition: () => {
        debug('onLimitReachedTransition');
        deps.finishAttempt();
        deps.emitLimitReachedAttempts();
        deps.startCheckTelephony();
      },
      /** Успешный invoke `connect`. */
      onConnectDone: () => {
        debug('onConnectDone');
        deps.onConnectSucceeded();
      },
      assignHaltedError: assign({
        stopReason: () => {
          return 'halted' as const;
        },
        lastError: ({ event }: { event: unknown }) => {
          const error = getInvokeError(event as never);

          debug('assignHaltedError', error);

          return error as unknown;
        },
      }),
      assignCancelledNotActualError: assign({
        stopReason: () => {
          return 'cancelled' as const;
        },
        lastError: ({ event }: { event: unknown }) => {
          const error = getInvokeError(event as never);

          debug('assignCancelledNotActualError', error);

          return error as unknown;
        },
      }),
      assignWaitRetryCancelledError: assign({
        stopReason: () => {
          return 'cancelled' as const;
        },
        lastError: ({ event }: { event: unknown }) => {
          const error = getInvokeError(event as never);

          debug('assignWaitRetryCancelledError', error);

          return error as unknown;
        },
      }),
      assignWaitRetryFailedError: assign({
        stopReason: () => {
          return 'failed' as const;
        },
        lastError: ({ event }: { event: unknown }) => {
          const error = getInvokeError(event as never);

          debug('assignWaitRetryFailedError', error);

          return error as unknown;
        },
      }),
      /**
       * Внешние события эмитятся уже после входа в `errorTerminal`.
       * Так машина хранит одну терминальную вершину, но не теряет различие причин остановки.
       */
      emitTerminalOutcome: ({ context }) => {
        deps.finishAttempt();

        if (context.stopReason === 'halted') {
          deps.onStopAttemptsByError(context.lastError);

          return;
        }

        if (context.stopReason === 'cancelled') {
          if (hasConnectionPromiseIsNotActualError(context.lastError)) {
            deps.emitCancelledAttemptsRaw(context.lastError);
          } else {
            deps.emitCancelledAttemptsWrapped(context.lastError);
          }

          return;
        }

        if (context.stopReason === 'failed') {
          deps.onFailedAllAttempts(context.lastError);

          return;
        }

        /* istanbul ignore next -- errorTerminal is entered only after assign*Error actions */
        debug('emitTerminalOutcome without stopReason', context.lastError);
      },
      /**
       * Режим check-telephony: соединение уже есть — только `success` и стоп триггеров.
       * После упрощения графа это тот же «monitoring» режим, просто вход в него происходит
       * без нового вызова `connect`.
       */
      onTelephonyStillConnected: () => {
        debug('onTelephonyStillConnected');
        deps.onTelephonyStillConnected();
      },
    },
  }).createMachine({
    id: 'autoConnector',
    initial: AUTO_CONNECTOR_STATE_IDS.IDLE,
    context: initialContext,
    states: {
      /** Ожидание: допустимы рестарт флоу или внешний стоп без побочных эффектов. */
      [AUTO_CONNECTOR_STATE_IDS.IDLE]: {
        on: {
          'AUTO.STOP': {
            target: AUTO_CONNECTOR_STATE_IDS.IDLE,
          },
          'AUTO.RESTART': {
            target: AUTO_CONNECTOR_STATE_IDS.DISCONNECTING,
            actions: 'assignRestart',
          },
          'FLOW.RESTART': {
            target: AUTO_CONNECTOR_STATE_IDS.DISCONNECTING,
            actions: 'assignFlowRestart',
          },
        },
      },
      /**
       * Безопасная остановка: invoke `stopConnectionFlow`.
       * Повторный `AUTO.STOP` с `reenter` перезапускает invoke (например сеть недоступна до `success`).
       */
      [AUTO_CONNECTOR_STATE_IDS.DISCONNECTING]: {
        invoke: {
          id: 'stopConnectionFlow',
          src: 'stopConnectionFlow',
          onDone: [
            {
              guard: 'shouldGoIdleAfterDisconnect',
              target: AUTO_CONNECTOR_STATE_IDS.IDLE,
            },
            {
              guard: 'shouldAttemptAfterDisconnect',
              target: AUTO_CONNECTOR_STATE_IDS.ATTEMPTING_GATE,
            },
          ],
          onError: {
            actions: 'logRestartFailed',
            target: AUTO_CONNECTOR_STATE_IDS.IDLE,
          },
        },
        on: {
          'AUTO.STOP': {
            target: AUTO_CONNECTOR_STATE_IDS.DISCONNECTING,
            reenter: true,
            actions: 'assignStop',
          },
          'AUTO.RESTART': {
            actions: 'assignRestart',
          },
          'FLOW.RESTART': {
            actions: 'assignFlowRestart',
          },
        },
      },
      /**
       * Перед новой попыткой: событие `before-attempt` и сброс триггеров; ветвление по лимиту.
       */
      [AUTO_CONNECTOR_STATE_IDS.ATTEMPTING_GATE]: {
        entry: 'entryAttemptingGate',
        always: [
          {
            guard: 'isLimitReached',
            target: AUTO_CONNECTOR_STATE_IDS.TELEPHONY_CHECKING,
            actions: 'onLimitReachedTransition',
          },
          {
            target: AUTO_CONNECTOR_STATE_IDS.ATTEMPTING_CONNECT,
          },
        ],
        on: withStopAndRestart(),
      },
      /**
       * Активный `connect`; ошибки классифицируются по бизнес-семантике:
       * - no retry -> терминальное состояние с событием `stop-attempts-by-error`;
       * - promise is not actual -> терминальное состояние с `cancelled-attempts`;
       * - всё остальное -> `waitingBeforeRetry`.
       */
      [AUTO_CONNECTOR_STATE_IDS.ATTEMPTING_CONNECT]: {
        entry: 'entryAttemptingConnect',
        invoke: {
          id: 'connect',
          src: 'connect',
          input: ({ context }: { context: TAutoConnectorContext }) => {
            // Параметры задаются assignRestart до входа в attemptingConnect.
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- инвариант контекста
            return context.parameters!;
          },
          onDone: {
            target: AUTO_CONNECTOR_STATE_IDS.CONNECTED_MONITORING,
            actions: 'onConnectDone',
          },
          onError: [
            {
              guard: 'isNotReadyForConnection',
              target: 'errorTerminal',
              actions: 'assignHaltedError',
            },
            {
              guard: 'isNoRetryPolicy',
              target: 'errorTerminal',
              actions: 'assignHaltedError',
            },
            {
              guard: 'isNotActualPromise',
              target: 'errorTerminal',
              actions: 'assignCancelledNotActualError',
            },
            {
              target: AUTO_CONNECTOR_STATE_IDS.WAITING_BEFORE_RETRY,
            },
          ],
        },
        on: withStopAndRestart(),
      },
      /**
       * Задержка и `onBeforeRetry` перед следующим заходом в `attemptingGate`.
       * Здесь различаем отмену управляемой цепочки (`cancelled-attempts`) и реальную
       * фатальную ошибку подготовки ретрая (`failed-all-attempts`).
       */
      [AUTO_CONNECTOR_STATE_IDS.WAITING_BEFORE_RETRY]: {
        invoke: {
          id: 'waitBeforeRetry',
          src: 'waitBeforeRetry',
          onDone: {
            target: AUTO_CONNECTOR_STATE_IDS.ATTEMPTING_GATE,
          },
          onError: [
            {
              guard: 'isWaitRetryCancelled',
              target: 'errorTerminal',
              actions: 'assignWaitRetryCancelledError',
            },
            {
              target: 'errorTerminal',
              actions: 'assignWaitRetryFailedError',
            },
          ],
        },
        on: withStopAndRestart(),
      },
      /** Подключение установлено; ожидание внешних событий (стоп, рестарт, ping). */
      [AUTO_CONNECTOR_STATE_IDS.CONNECTED_MONITORING]: {
        on: withStopRestartAndFlowRestart(),
      },
      /**
       * После лимита: работает check-telephony; если соединение уже живо, возвращаемся
       * в обычный monitoring-режим без промежуточного состояния `standby`.
       */
      [AUTO_CONNECTOR_STATE_IDS.TELEPHONY_CHECKING]: {
        on: {
          'AUTO.STOP': {
            target: AUTO_CONNECTOR_STATE_IDS.DISCONNECTING,
            actions: 'assignStop',
          },
          'AUTO.RESTART': {
            target: AUTO_CONNECTOR_STATE_IDS.DISCONNECTING,
            actions: 'assignRestart',
          },
          'TELEPHONY.RESULT': {
            target: AUTO_CONNECTOR_STATE_IDS.CONNECTED_MONITORING,
            actions: 'onTelephonyStillConnected',
          },
        },
      },
      /**
       * Единое терминальное состояние для остановленных попыток.
       * Конкретная причина хранится в `context.stopReason`, а наружу по-прежнему
       * эмитятся прежние события в `entry`, сразу после входа в состояние.
       */
      [AUTO_CONNECTOR_STATE_IDS.ERROR_TERMINAL]: {
        entry: 'emitTerminalOutcome',
        on: withStopAndRestart(),
      },
    },
  });
};
