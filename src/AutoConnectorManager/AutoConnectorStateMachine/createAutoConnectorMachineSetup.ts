import { isCanceledError } from '@krivega/cancelable-promise';
import { hasCanceledError } from '@krivega/timeout-requester';
import { assign, fromPromise, setup } from 'xstate';

import { hasNotReadyForConnectionError } from '@/ConnectionManager';
import { hasConnectionPromiseIsNotActualError } from '@/ConnectionQueueManager';
import logger from '@/logger';
import { getInvokeError } from './getInvokeError';

import type {
  TAutoConnectorContext,
  TAutoConnectorEvent,
  TAutoConnectorMachineDeps,
} from './types';
import type { TParametersAutoConnect } from '../types';

const debug = (message: string, ...args: unknown[]) => {
  logger(`[AutoConnectorMachine] ${message}`, ...args);
};

const getRequiredParameters = (context: TAutoConnectorContext, actionName: string) => {
  /* istanbul ignore next -- graph invariants require parameters before reaching these actions */
  if (!context.parameters) {
    throw new Error(`Auto connector parameters are missing in ${actionName} action`);
  }

  return context.parameters;
};

export const createAutoConnectorMachineSetup = (deps: TAutoConnectorMachineDeps) => {
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
      connect: fromPromise(async ({ input }: { input: TParametersAutoConnect | undefined }) => {
        debug('connect', input);

        if (!input) {
          throw new Error('Auto connector parameters are missing in attemptingConnect state');
        }

        await deps.connect(input);
      }),
      /** Invoke в `waitingBeforeRetry`: сначала задержка между попытками. */
      waitBeforeRetry: fromPromise(async () => {
        debug('waitBeforeRetry');
        await deps.delayBetweenAttempts();
      }),
    },
    /** Условия переходов после `disconnect`, классификация ошибок `connect` и ретрая. */
    guards: {
      /** Нужен ли промежуточный `disconnecting` перед новым циклом попытки. */
      shouldDisconnectBeforeAttempt: () => {
        return deps.shouldDisconnectBeforeAttempt();
      },
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
      /** Отмена задержки (cancelable / timeout-requester). */
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
        deps.beforeAttempt();
      },
      /** Учёт попытки в `AttemptsState` непосредственно перед `connect`. */
      entryAttemptingConnect: () => {
        deps.beforeConnectAttempt();
      },
      /** Лимит: завершить попытку, событие лимита, запуск опроса телефонии. */
      onLimitReachedTransition: ({ context }) => {
        deps.onLimitReached(getRequiredParameters(context, 'onLimitReachedTransition'));
      },
      /** Успешный invoke `connect`. */
      onConnectDone: ({ context }) => {
        deps.onConnectSucceeded(getRequiredParameters(context, 'onConnectDone'));
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
        deps.emitTerminalOutcome({
          stopReason: context.stopReason,
          lastError: context.lastError,
        });
      },
      /**
       * Режим check-telephony: соединение уже есть — только `success` и стоп триггеров.
       * После упрощения графа это тот же «monitoring» режим, просто вход в него происходит
       * без нового вызова `connect`.
       */
      onTelephonyStillConnected: () => {
        deps.onTelephonyStillConnected();
      },
    },
  });
};
