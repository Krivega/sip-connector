import { isCanceledError } from '@krivega/cancelable-promise';
import { hasCanceledError } from '@krivega/timeout-requester';
import { assign, fromPromise, setup } from 'xstate';

import { hasNotReadyForConnectionError } from '@/ConnectionManager';
import { hasConnectionPromiseIsNotActualError } from '@/ConnectionQueueManager';
import logger from '@/logger';
import { getInvokeError } from './getInvokeError';
import { AUTO_CONNECTOR_STATE_IDS } from './types';

import type { TAutoConnectorContext, TAutoConnectorEvent } from './types';
import type { TParametersAutoConnect } from '../types';

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
        await deps.stopConnectionFlow();
      }),
      /** Invoke в `attemptingConnect`: реальный SIP/WebSocket connect. */
      connect: fromPromise(async ({ input }: { input: TParametersAutoConnect }) => {
        await deps.connect(input);
      }),
      /** Invoke в `waitingBeforeRetry`: сначала задержка между попытками, затем `onBeforeRetry`. */
      waitBeforeRetry: fromPromise(async () => {
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
      /** Событие успешной проверки телефонии при уже установленном соединении. */
      isTelephonyStillConnected: ({ event }) => {
        return event.type === 'TELEPHONY.RESULT';
      },
    },
    /** Синхронные побочные эффекты и обновление контекста (`assign`). */
    actions: {
      /** Лог при падении invoke `stopConnectionFlow` при рестарте. */
      logRestartFailed: ({ event }) => {
        logger('auto connector failed to restart connection attempts:', getInvokeError(event));
      },
      /** Сохранить параметры подключения и намерение продолжить попытки после `disconnect`. */
      assignRestart: assign({
        parameters: ({ event }) => {
          return (event as { type: 'AUTO.RESTART'; parameters: TParametersAutoConnect }).parameters;
        },
        afterDisconnect: () => {
          return 'attempt' as const;
        },
      }),
      /** Рестарт мониторинга без смены `parameters` (ping / внутренний перезапуск). */
      assignFlowRestart: assign({
        afterDisconnect: 'attempt' as const,
      }),
      /** Пользовательский или внешний стоп: после `disconnect` уйти в `idle`. */
      assignStop: assign({
        afterDisconnect: 'idle' as const,
      }),
      /** Начало цикла попытки: событие «перед попыткой» и сброс внешних триггеров. */
      entryAttemptingGate: () => {
        deps.emitBeforeAttempt();
        deps.stopConnectTriggers();
      },
      /** Учёт попытки в `AttemptsState` непосредственно перед `connect`. */
      entryAttemptingConnect: () => {
        deps.startAttempt();
        deps.incrementAttempt();
      },
      /** Лимит: завершить попытку, событие лимита, запуск опроса телефонии. */
      onLimitReachedTransition: () => {
        deps.finishAttempt();
        deps.emitLimitReachedAttempts();
        deps.startCheckTelephony();
      },
      /** Успешный invoke `connect`. */
      onConnectDone: () => {
        deps.onConnectSucceeded();
      },
      /** Терминальная ошибка без ретрая. */
      onHaltedByError: ({ event }) => {
        deps.finishAttempt();
        deps.onStopAttemptsByError(getInvokeError(event));
      },
      /** Отмена из-за «неактуального» промиса коннекта. */
      onCancelledNotActual: ({ event }) => {
        deps.finishAttempt();
        deps.emitCancelledAttemptsRaw(getInvokeError(event));
      },
      /** Отмена на этапе задержки / `onBeforeRetry`. */
      onWaitRetryCancelled: ({ event }) => {
        deps.finishAttempt();
        deps.emitCancelledAttemptsWrapped(getInvokeError(event));
      },
      /** Не отмена: окончательный провал цепочки ретрая. */
      onWaitRetryFailed: ({ event }) => {
        deps.finishAttempt();
        deps.onFailedAllAttempts(getInvokeError(event));
      },
      /** Режим check-telephony: соединение уже есть — только `success` и стоп триггеров. */
      onTelephonyStillConnected: () => {
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
        on: {
          'AUTO.STOP': {
            target: AUTO_CONNECTOR_STATE_IDS.DISCONNECTING,
            actions: 'assignStop',
          },
          'AUTO.RESTART': {
            target: AUTO_CONNECTOR_STATE_IDS.DISCONNECTING,
            actions: 'assignRestart',
          },
        },
      },
      /** Активный `connect`; ошибки классифицируются гвардами, с ретраем — в ожидание перед повтором. */
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
              target: AUTO_CONNECTOR_STATE_IDS.HALTED_BY_ERROR,
              actions: 'onHaltedByError',
            },
            {
              guard: 'isNoRetryPolicy',
              target: AUTO_CONNECTOR_STATE_IDS.HALTED_BY_ERROR,
              actions: 'onHaltedByError',
            },
            {
              guard: 'isNotActualPromise',
              target: AUTO_CONNECTOR_STATE_IDS.CANCELLED,
              actions: 'onCancelledNotActual',
            },
            {
              target: AUTO_CONNECTOR_STATE_IDS.WAITING_BEFORE_RETRY,
            },
          ],
        },
        on: {
          'AUTO.STOP': {
            target: AUTO_CONNECTOR_STATE_IDS.DISCONNECTING,
            actions: 'assignStop',
          },
          'AUTO.RESTART': {
            target: AUTO_CONNECTOR_STATE_IDS.DISCONNECTING,
            actions: 'assignRestart',
          },
        },
      },
      /** Задержка и `onBeforeRetry` перед следующим заходом в `attemptingGate`. */
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
              target: AUTO_CONNECTOR_STATE_IDS.CANCELLED,
              actions: 'onWaitRetryCancelled',
            },
            {
              target: AUTO_CONNECTOR_STATE_IDS.FAILED,
              actions: 'onWaitRetryFailed',
            },
          ],
        },
        on: {
          'AUTO.STOP': {
            target: AUTO_CONNECTOR_STATE_IDS.DISCONNECTING,
            actions: 'assignStop',
          },
          'AUTO.RESTART': {
            target: AUTO_CONNECTOR_STATE_IDS.DISCONNECTING,
            actions: 'assignRestart',
          },
        },
      },
      /** Подключение установлено; ожидание внешних событий (стоп, рестарт, ping). */
      [AUTO_CONNECTOR_STATE_IDS.CONNECTED_MONITORING]: {
        on: {
          'AUTO.STOP': {
            target: AUTO_CONNECTOR_STATE_IDS.DISCONNECTING,
            actions: 'assignStop',
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
      /** После лимита: работает check-telephony; успех при уже живом коннекте ведёт в `standby`. */
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
            guard: 'isTelephonyStillConnected',
            target: AUTO_CONNECTOR_STATE_IDS.STANDBY,
            actions: 'onTelephonyStillConnected',
          },
        },
      },
      /** Успех check-telephony без нового коннекта; дальше только стоп/рестарт. */
      [AUTO_CONNECTOR_STATE_IDS.STANDBY]: {
        on: {
          'AUTO.STOP': {
            target: AUTO_CONNECTOR_STATE_IDS.DISCONNECTING,
            actions: 'assignStop',
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
      /** Ошибка без ретрая; выход — новый `AUTO.RESTART` или полный стоп. */
      [AUTO_CONNECTOR_STATE_IDS.HALTED_BY_ERROR]: {
        on: {
          'AUTO.RESTART': {
            target: AUTO_CONNECTOR_STATE_IDS.DISCONNECTING,
            actions: 'assignRestart',
          },
          'AUTO.STOP': {
            target: AUTO_CONNECTOR_STATE_IDS.DISCONNECTING,
            actions: 'assignStop',
          },
        },
      },
      /** Отмена попыток; дальше как у `halted`. */
      [AUTO_CONNECTOR_STATE_IDS.CANCELLED]: {
        on: {
          'AUTO.RESTART': {
            target: AUTO_CONNECTOR_STATE_IDS.DISCONNECTING,
            actions: 'assignRestart',
          },
          'AUTO.STOP': {
            target: AUTO_CONNECTOR_STATE_IDS.DISCONNECTING,
            actions: 'assignStop',
          },
        },
      },
      /** Исчерпан ретрай (`failed-all-attempts`). */
      [AUTO_CONNECTOR_STATE_IDS.FAILED]: {
        on: {
          'AUTO.RESTART': {
            target: AUTO_CONNECTOR_STATE_IDS.DISCONNECTING,
            actions: 'assignRestart',
          },
          'AUTO.STOP': {
            target: AUTO_CONNECTOR_STATE_IDS.DISCONNECTING,
            actions: 'assignStop',
          },
        },
      },
    },
  });
};
