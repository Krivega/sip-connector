import { createAutoConnectorMachineSetup } from './createAutoConnectorMachineSetup';
import { EState } from './types';

import type { TAutoConnectorContext, TAutoConnectorMachineDeps } from './types';

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
  'AUTO.STOP': { target: EState; actions: 'assignStop' };
  'AUTO.RESTART': { target: EState; actions: 'assignRestart' };
};

const withStopAndRestart = (): TStopRestartTransitions => {
  return {
    'AUTO.STOP': {
      target: EState.DISCONNECTING,
      actions: 'assignStop' as const,
    },
    'AUTO.RESTART': {
      target: EState.DISCONNECTING,
      actions: 'assignRestart' as const,
    },
  };
};

const withStopRestartAndFlowRestart = () => {
  return {
    ...withStopAndRestart(),
    'FLOW.RESTART': {
      target: EState.DISCONNECTING,
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
  return createAutoConnectorMachineSetup(deps).createMachine({
    id: 'autoConnector',
    initial: EState.IDLE,
    context: initialContext,
    states: {
      /** Ожидание: допустимы рестарт флоу или внешний стоп без побочных эффектов. */
      [EState.IDLE]: {
        on: {
          'AUTO.STOP': {
            target: EState.IDLE,
          },
          'AUTO.RESTART': {
            target: EState.DISCONNECTING,
            actions: 'assignRestart',
          },
          'FLOW.RESTART': {
            target: EState.DISCONNECTING,
            actions: 'assignFlowRestart',
          },
        },
      },
      /**
       * Безопасная остановка: invoke `stopConnectionFlow`.
       * Повторный `AUTO.STOP` с `reenter` перезапускает invoke (например сеть недоступна до `success`).
       */
      [EState.DISCONNECTING]: {
        invoke: {
          // `id` — имя (identity) конкретного invoke внутри этого состояния.
          // Полезно для отладки, трейсинга и invoke-событий вида `xstate.done.actor.<id>`.
          id: 'stopConnectionFlow',
          // `src` — ключ actor-реализации из `setup({ actors: ... })`.
          // Здесь берётся `actors.stopConnectionFlow` из `createAutoConnectorMachineSetup`.
          src: 'stopConnectionFlow',
          /**
           * Успешный `disconnect` маршрутизируем по контексту:
           * - `afterDisconnect = idle` -> полная остановка;
           * - `afterDisconnect = attempt` -> продолжаем цикл реконнекта.
           */
          onDone: [
            {
              guard: 'shouldGoIdleAfterDisconnect',
              target: EState.IDLE,
            },
            {
              guard: 'shouldAttemptAfterDisconnect',
              target: EState.ATTEMPTING_GATE,
            },
          ],
          onError: {
            actions: 'logRestartFailed',
            target: EState.IDLE,
          },
        },
        on: {
          'AUTO.STOP': {
            target: EState.DISCONNECTING,
            // Принудительно пере-входим в то же состояние, чтобы заново запустить invoke `stopConnectionFlow`.
            // Без `reenter: true` повторный STOP в текущем состоянии не перезапустил бы actor остановки.
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
      [EState.ATTEMPTING_GATE]: {
        entry: 'entryAttemptingGate',
        always: [
          {
            guard: 'isLimitReached',
            target: EState.TELEPHONY_CHECKING,
            actions: 'onLimitReachedTransition',
          },
          {
            target: EState.ATTEMPTING_CONNECT,
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
      [EState.ATTEMPTING_CONNECT]: {
        entry: 'entryAttemptingConnect',
        invoke: {
          // `id` остаётся стабильным идентификатором этого invoke-блока в состоянии.
          id: 'connect',
          // `src` указывает, какой actor запускать при входе в состояние.
          src: 'connect',
          input: ({ context }: { context: TAutoConnectorContext }) => {
            return context.parameters;
          },
          // `connect` завершился без ошибки -> считаем подключение установленным и переходим в мониторинг.
          onDone: {
            target: EState.CONNECTED_MONITORING,
            actions: 'onConnectDone',
          },
          /**
           * Важно: `onError`-ветки проверяются сверху вниз.
           * XState берёт ПЕРВУЮ ветку, у которой guard вернул true.
           */
          onError: [
            {
              // 1) Инвариант/стейт не готов к connect -> retry бессмысленен, останавливаемся.
              guard: 'isNotReadyForConnection',
              target: 'errorTerminal',
              actions: 'assignHaltedError',
            },
            {
              // 2) Политика опций явно запрещает retry для этой ошибки.
              guard: 'isNoRetryPolicy',
              target: 'errorTerminal',
              actions: 'assignHaltedError',
            },
            {
              // 3) Текущий connect устарел (появился более свежий запрос) -> cancelled.
              guard: 'isNotActualPromise',
              target: 'errorTerminal',
              actions: 'assignCancelledNotActualError',
            },
            {
              // 4) Все остальные ошибки считаем retryable и идём в backoff/ожидание.
              target: EState.WAITING_BEFORE_RETRY,
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
      [EState.WAITING_BEFORE_RETRY]: {
        invoke: {
          // `id` для invoke шага ожидания перед retry.
          id: 'waitBeforeRetry',
          // `src` ссылается на actor из setup (`actors.waitBeforeRetry`).
          src: 'waitBeforeRetry',
          // Успешно прошли delay + onBeforeRetry -> возвращаемся к шлюзу следующей попытки.
          onDone: {
            target: EState.ATTEMPTING_GATE,
          },
          /**
           * Здесь тот же принцип: ветки `onError` проверяются сверху вниз,
           * срабатывает первая подходящая.
           */
          onError: [
            {
              // Отмена управляемой цепочки (cancel token / timeout requester stop).
              guard: 'isWaitRetryCancelled',
              target: 'errorTerminal',
              actions: 'assignWaitRetryCancelledError',
            },
            {
              // Любая иная ошибка подготовки retry считается фатальной.
              target: 'errorTerminal',
              actions: 'assignWaitRetryFailedError',
            },
          ],
        },
        on: withStopAndRestart(),
      },
      /** Подключение установлено; ожидание внешних событий (стоп, рестарт, ping). */
      [EState.CONNECTED_MONITORING]: {
        on: withStopRestartAndFlowRestart(),
      },
      /**
       * После лимита: работает check-telephony; если соединение уже живо, возвращаемся
       * в обычный monitoring-режим без промежуточного состояния `standby`.
       */
      [EState.TELEPHONY_CHECKING]: {
        on: {
          'AUTO.STOP': {
            target: EState.DISCONNECTING,
            actions: 'assignStop',
          },
          'AUTO.RESTART': {
            target: EState.DISCONNECTING,
            actions: 'assignRestart',
          },
          'TELEPHONY.RESULT': {
            target: EState.CONNECTED_MONITORING,
            actions: 'onTelephonyStillConnected',
          },
        },
      },
      /**
       * Единое терминальное состояние для остановленных попыток.
       * Конкретная причина хранится в `context.stopReason`, а наружу по-прежнему
       * эмитятся прежние события в `entry`, сразу после входа в состояние.
       */
      [EState.ERROR_TERMINAL]: {
        entry: 'emitTerminalOutcome',
        on: withStopAndRestart(),
      },
    },
  });
};
