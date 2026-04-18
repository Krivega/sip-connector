import {
  createCallReconnectMachineSetup,
  getAttemptingParameters,
} from './createCallReconnectMachineSetup';
import { EState } from './types';

import type { TCallReconnectMachineDeps, TContext, TContextMap } from './types';

const initialContext = (): TContextMap[EState.IDLE] => {
  return {
    parameters: undefined,
    attempt: 0,
    nextDelayMs: 0,
    lastError: undefined,
    lastFailureCause: undefined,
    cancelledReason: undefined,
  };
};

/**
 * Конечный автомат редиала при сетевом обрыве звонка.
 *
 * Граф состояний:
 * - `idle` — неармирован; ждёт `RECONNECT.ARM`.
 * - `armed` — активен, слушает `CALL.FAILED`.
 * - `evaluating` — решает ветку: backoff / waitingSignaling / limitReached.
 * - `backoff` — таймаут задержки; затем `attempting`.
 * - `waitingSignaling` — ждём восстановления сигнализации; затем `backoff`.
 * - `attempting` — invoke `startCall`.
 * - `limitReached` — исчерпан лимит; ждём `RECONNECT.FORCE` или `RECONNECT.DISARM`.
 * - `errorTerminal` — нефатальные ветки ретрая (halt ошибка или timeout сигнализации).
 */
export const createCallReconnectMachine = (deps: TCallReconnectMachineDeps) => {
  return createCallReconnectMachineSetup(deps).createMachine({
    id: 'callReconnect',
    initial: EState.IDLE,
    context: initialContext,
    on: {
      /**
       * Глобальный `RECONNECT.ARM`: из любого состояния возвращает армированный цикл
       * с актуальными параметрами (user-driven rearm в середине цикла).
       */
      'RECONNECT.ARM': {
        target: `.${EState.ARMED}`,
        actions: ['cancelAll', 'resetAttemptsState', 'assignArm', 'emitArmedAction'],
      },
      /**
       * Глобальный `RECONNECT.DISARM`: в любом не-idle состоянии снимает подписку,
       * отменяет in-flight, эмитит `disarmed`/`cancelled` и уводит в `idle`.
       * В `idle` обрабатывается отдельно — там достаточно ассайна без эмита.
       */
      'RECONNECT.DISARM': {
        target: `.${EState.IDLE}`,
        actions: [
          'cancelAll',
          'resetAttemptsState',
          'registerAttemptFinish',
          'assignDisarm',
          'emitDisarmedAction',
        ],
      },
    },
    states: {
      [EState.IDLE]: {
        on: {
          'RECONNECT.DISARM': {
            /* istanbul ignore next -- `RECONNECT.DISARM` в `idle` не эмитит событий */
            target: EState.IDLE,
          },
        },
      },
      [EState.ARMED]: {
        on: {
          'CALL.FAILED': {
            guard: 'isNetworkFailure',
            target: EState.EVALUATING,
            actions: ['assignFailureDetected', 'emitFailureDetectedAction'],
          },
          'CALL.ENDED': {
            target: EState.IDLE,
            actions: ['cancelAll', 'resetAttemptsState', 'assignDisarm', 'emitDisarmedAction'],
          },
        },
      },
      /**
       * Транзитное состояние — `always` ветвление по политикам.
       * Порядок важен: сначала лимит, потом сигнализация (иначе выпадем в backoff при исчерпанных попытках).
       */
      [EState.EVALUATING]: {
        always: [
          {
            guard: 'isLimitReached',
            target: EState.LIMIT_REACHED,
            actions: ['emitLimitReachedAction'],
          },
          {
            guard: 'isSignalingReady',
            target: EState.BACKOFF,
            actions: ['assignNextDelay', 'emitAttemptScheduledAction'],
          },
          {
            target: EState.WAITING_SIGNALING,
            actions: ['emitWaitingSignalingAction'],
          },
        ],
      },
      [EState.BACKOFF]: {
        invoke: {
          id: 'delayBeforeAttempt',
          src: 'delayBeforeAttempt',
          input: ({ context }: { context: TContext }) => {
            return context.nextDelayMs;
          },
          onDone: {
            target: EState.ATTEMPTING,
          },
          /**
           * Отмена задержки (через `DelayRequester`) возвращает нас в `armed`.
           * Фатальных ошибок у `delayBeforeAttempt` нет — причина только cancel.
           */
          onError: {
            target: EState.ARMED,
          },
        },
        on: {
          'CONN.DISCONNECTED': {
            target: EState.WAITING_SIGNALING,
            actions: ['emitWaitingSignalingAction'],
          },
        },
      },
      [EState.WAITING_SIGNALING]: {
        invoke: {
          id: 'waitSignalingReady',
          src: 'waitSignalingReady',
          onDone: {
            target: EState.BACKOFF,
            actions: ['assignNextDelay', 'emitAttemptScheduledAction'],
          },
          onError: [
            {
              guard: 'isAttemptCancelled',
              target: EState.ARMED,
            },
            {
              target: EState.ERROR_TERMINAL,
              actions: 'assignAttemptError',
            },
          ],
        },
        on: {
          'CONN.CONNECTED': {
            target: EState.BACKOFF,
            actions: ['assignNextDelay', 'emitAttemptScheduledAction'],
          },
        },
      },
      [EState.ATTEMPTING]: {
        entry: ['assignIncrementAttempt', 'registerAttemptStart', 'emitAttemptStartedAction'],
        invoke: {
          id: 'performAttempt',
          src: 'performAttempt',
          input: ({ context }: { context: TContext }) => {
            return getAttemptingParameters(context);
          },
          onDone: {
            target: EState.ARMED,
            actions: [
              'registerAttemptFinish',
              'assignResetAttempt',
              'resetAttemptsState',
              'emitAttemptSucceededAction',
            ],
          },
          onError: [
            {
              guard: 'isAttemptCancelled',
              target: EState.ARMED,
              actions: ['registerAttemptFinish'],
            },
            {
              guard: 'isNoRetryPolicy',
              target: EState.ERROR_TERMINAL,
              actions: ['registerAttemptFinish', 'emitAttemptFailedAction', 'assignAttemptError'],
            },
            {
              target: EState.EVALUATING,
              actions: ['registerAttemptFinish', 'emitAttemptFailedAction'],
            },
          ],
        },
      },
      [EState.LIMIT_REACHED]: {
        on: {
          'RECONNECT.FORCE': {
            target: EState.EVALUATING,
            actions: ['resetAttemptsState', 'assignResetAttempt'],
          },
        },
      },
      [EState.ERROR_TERMINAL]: {
        on: {
          'RECONNECT.FORCE': {
            target: EState.EVALUATING,
            actions: ['resetAttemptsState', 'assignResetAttempt'],
          },
        },
      },
    },
  });
};
