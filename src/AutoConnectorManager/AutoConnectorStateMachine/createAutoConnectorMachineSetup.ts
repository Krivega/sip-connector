import { isCanceledError } from '@krivega/cancelable-promise';
import { hasCanceledError } from '@krivega/timeout-requester';
import { assign, fromPromise, setup } from 'xstate';

import { hasNotReadyForConnectionError } from '@/ConnectionManager';
import { hasConnectionPromiseIsNotActualError } from '@/ConnectionQueueManager';
import resolveDebug from '@/logger';
import { getInvokeError } from './getInvokeError';

import type {
  EState,
  TContext,
  TAutoConnectorEvent,
  TAutoConnectorMachineDeps,
  TContextMap,
} from './types';
import type { TParametersAutoConnect } from '../types';

const debug = resolveDebug('AutoConnectorMachine');

type TAttemptFlowContext =
  | TContextMap[EState.ATTEMPTING_GATE]
  | TContextMap[EState.ATTEMPTING_CONNECT]
  | TContextMap[EState.WAITING_BEFORE_RETRY]
  | TContextMap[EState.CONNECTED_MONITORING]
  | TContextMap[EState.TELEPHONY_CHECKING];

const getAttemptFlowParameters = (context: TContext): TParametersAutoConnect => {
  return (context as TAttemptFlowContext).parameters;
};

export const createAutoConnectorMachineSetup = (deps: TAutoConnectorMachineDeps) => {
  return setup({
    types: {
      context: {} as TContext,
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

        /* istanbul ignore next -- defensive guard for overridden actions in tests/provide */
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
        const shouldDisconnectBeforeAttempt = deps.shouldDisconnectBeforeAttempt();

        debug('shouldDisconnectBeforeAttempt:', shouldDisconnectBeforeAttempt);

        return shouldDisconnectBeforeAttempt;
      },
      /** После `stopConnectionFlow` уходим в `idle` (полная остановка / ошибка остановки). */
      shouldGoIdleAfterDisconnect: ({ context }) => {
        const shouldGoIdleAfterDisconnect = context.afterDisconnect === 'idle';

        debug('shouldGoIdleAfterDisconnect:', shouldGoIdleAfterDisconnect);

        return shouldGoIdleAfterDisconnect;
      },
      /** После `stopConnectionFlow` продолжаем цикл: к шлюзу попытки. */
      shouldAttemptAfterDisconnect: ({ context }) => {
        const shouldAttemptAfterDisconnect = context.afterDisconnect === 'attempt';

        debug('shouldAttemptAfterDisconnect:', shouldAttemptAfterDisconnect);

        return shouldAttemptAfterDisconnect;
      },
      /** Лимит попыток исчерпан — переход к режиму check-telephony. */
      isLimitReached: () => {
        const isLimitReached = deps.hasLimitReached();

        debug('isLimitReached:', isLimitReached);

        return isLimitReached;
      },
      /** Ошибка «ещё не готовы к подключению» — без ретрая. */
      isNotReadyForConnection: ({ event }) => {
        const isNotReadyForConnection = hasNotReadyForConnectionError(getInvokeError(event));

        debug('isNotReadyForConnection:', isNotReadyForConnection);

        return isNotReadyForConnection;
      },
      /** Политика опций запрещает повтор для этой ошибки. */
      isNoRetryPolicy: ({ event }) => {
        const isNoRetryPolicy = !deps.canRetryOnError(getInvokeError(event));

        debug('isNoRetryPolicy:', isNoRetryPolicy);

        return isNoRetryPolicy;
      },
      /** Промис коннекта снят очередью (`stack-promises`) — отмена попыток. */
      isNotActualPromise: ({ event }) => {
        const isNotActualPromise = hasConnectionPromiseIsNotActualError(getInvokeError(event));

        debug('isNotActualPromise:', isNotActualPromise);

        return isNotActualPromise;
      },
      /** Отмена задержки (cancelable / timeout-requester). */
      isWaitRetryCancelled: ({ event }) => {
        const error = getInvokeError(event);

        const isWaitRetryCancelled = isCanceledError(error) || hasCanceledError(error as Error);

        debug('isWaitRetryCancelled:', isWaitRetryCancelled);

        return isWaitRetryCancelled;
      },
    },
    /** Синхронные побочные эффекты и обновление контекста (`assign`). */
    actions: {
      /** Лог при падении invoke `stopConnectionFlow` при рестарте. */
      logRestartFailed: ({ event }) => {
        debug('auto connector failed to restart connection attempts:', getInvokeError(event));
      },
      /** Сохранить параметры подключения и намерение продолжить попытки после `disconnect`. */
      assignRestart: assign(({ event }) => {
        const restartEvent = event as { type: 'AUTO.RESTART'; parameters: TParametersAutoConnect };

        return {
          parameters: restartEvent.parameters,
          afterDisconnect: 'attempt' as const,
          stopReason: undefined,
          lastError: undefined,
        };
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
        deps.beforeAttempt();
      },
      /** Учёт попытки в `AttemptsState` непосредственно перед `connect`. */
      entryAttemptingConnect: () => {
        debug('entryAttemptingConnect');
        deps.beforeConnectAttempt();
      },
      /** Лимит: завершить попытку, событие лимита, запуск опроса телефонии. */
      onLimitReachedTransition: ({ context }) => {
        debug('onLimitReachedTransition');
        deps.onLimitReached(getAttemptFlowParameters(context));
      },
      /** Успешный invoke `connect`. */
      onConnectDone: ({ context }) => {
        debug('onConnectDone');
        deps.onConnectSucceeded(getAttemptFlowParameters(context));
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
        debug('emitTerminalOutcome');
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
        debug('onTelephonyStillConnected');
        deps.onTelephonyStillConnected();
      },
    },
  });
};
