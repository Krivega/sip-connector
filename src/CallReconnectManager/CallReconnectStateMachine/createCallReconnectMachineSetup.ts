import { isCanceledError } from '@krivega/cancelable-promise';
import { hasCanceledError } from '@krivega/timeout-requester';
import { assign, fromPromise, setup } from 'xstate';

import resolveDebug from '@/logger';
import { getInvokeError } from './getInvokeError';

import type { EndEvent } from '@krivega/jssip';
import type { TCallRedialParameters, TCancelledReason } from '../types';
import type {
  EState,
  TCallReconnectEvent,
  TCallReconnectMachineDeps,
  TContext,
  TContextMap,
} from './types';

const debug = resolveDebug('CallReconnectMachine');

type TArmEvent = { type: 'RECONNECT.ARM'; parameters: TCallRedialParameters };
type TDisarmEvent = { type: 'RECONNECT.DISARM'; reason?: TCancelledReason };
type TCallFailedEvent = { type: 'CALL.FAILED'; event: EndEvent };

type TAttemptingContext = TContextMap[EState.ATTEMPTING];

const getAttemptingParameters = (context: TContext): TCallRedialParameters => {
  return (context as TAttemptingContext).parameters;
};

export const createCallReconnectMachineSetup = (deps: TCallReconnectMachineDeps) => {
  return setup({
    types: {
      context: {} as TContext,
      events: {} as TCallReconnectEvent,
    },
    actors: {
      /** Invoke в `backoff`: таймаут задержки перед следующей попыткой. */
      delayBeforeAttempt: fromPromise(async ({ input }: { input: number }) => {
        debug('delayBeforeAttempt', input);
        await deps.delayBeforeAttempt(input);
      }),
      /** Invoke в `waitingSignaling`: ожидание готовности сигнализации с таймаутом. */
      waitSignalingReady: fromPromise(async () => {
        debug('waitSignalingReady');
        await deps.waitSignalingReady();
      }),
      /** Invoke в `attempting`: реальный `startCall`. */
      performAttempt: fromPromise(
        async ({ input }: { input: TCallRedialParameters | undefined }) => {
          debug('performAttempt');

          /* istanbul ignore next -- defensive guard, covered by TContextMap invariants */
          if (!input) {
            throw new Error('CallReconnect parameters missing in attempting state');
          }

          await deps.performAttempt(input);
        },
      ),
    },
    guards: {
      isNetworkFailure: ({ event }) => {
        const failedEvent = event as TCallFailedEvent;

        return deps.isNetworkFailure(failedEvent.event);
      },
      isLimitReached: () => {
        return deps.hasLimitReached();
      },
      isSignalingReady: () => {
        return deps.isSignalingReady();
      },
      isNoRetryPolicy: ({ event }) => {
        return !deps.canRetryOnError(getInvokeError(event));
      },
      isAttemptCancelled: ({ event }) => {
        const error = getInvokeError(event);

        return isCanceledError(error) || hasCanceledError(error as Error);
      },
    },
    actions: {
      assignArm: assign(({ event }) => {
        const armEvent = event as TArmEvent;

        return {
          parameters: armEvent.parameters,
          attempt: 0,
          nextDelayMs: 0,
          lastError: undefined,
          lastFailureCause: undefined,
          cancelledReason: undefined,
        };
      }),
      assignDisarm: assign(({ event }) => {
        const disarmEvent = event as TDisarmEvent;

        return {
          parameters: undefined,
          attempt: 0,
          nextDelayMs: 0,
          lastError: undefined,
          lastFailureCause: undefined,
          cancelledReason: disarmEvent.reason ?? 'disarm',
        };
      }),
      assignFailureDetected: assign(({ event }) => {
        const failedEvent = event as TCallFailedEvent;

        return {
          lastFailureCause: failedEvent.event.cause,
        };
      }),
      assignNextDelay: assign(({ context }) => {
        const nextAttempt = context.attempt + 1;

        return {
          nextDelayMs: deps.computeNextDelayMs(nextAttempt),
        };
      }),
      assignIncrementAttempt: assign(({ context }) => {
        return {
          attempt: context.attempt + 1,
        };
      }),
      assignResetAttempt: assign({
        attempt: () => {
          return 0;
        },
        nextDelayMs: () => {
          return 0;
        },
        lastError: () => {
          return undefined;
        },
        lastFailureCause: () => {
          return undefined;
        },
      }),
      assignAttemptError: assign({
        lastError: ({ event }: { event: unknown }) => {
          return getInvokeError(event as never);
        },
      }),
      emitArmedAction: () => {
        deps.emitArmed();
      },
      emitDisarmedAction: ({ context }) => {
        deps.emitDisarmed();

        const { cancelledReason } = context;

        /* istanbul ignore else -- cancelledReason всегда задан при входе в disarm-действие */
        if (cancelledReason !== undefined) {
          deps.emitCancelled({ reason: cancelledReason });
        }
      },
      emitFailureDetectedAction: ({ context, event }) => {
        const failedEvent = event as TCallFailedEvent;

        deps.emitFailureDetected({
          cause: failedEvent.event.cause,
          originator: failedEvent.event.originator,
          attempt: context.attempt,
        });
      },
      emitAttemptScheduledAction: ({ context }) => {
        deps.emitAttemptScheduled({
          attempt: context.attempt + 1,
          delayMs: context.nextDelayMs,
        });
      },
      emitAttemptStartedAction: ({ context }) => {
        deps.emitAttemptStarted({ attempt: context.attempt });
      },
      emitAttemptSucceededAction: ({ context }) => {
        deps.emitAttemptSucceeded({ attempt: context.attempt });
      },
      emitAttemptFailedAction: ({ context, event }) => {
        deps.emitAttemptFailed({
          attempt: context.attempt,
          error: getInvokeError(event),
        });
      },
      emitWaitingSignalingAction: () => {
        deps.emitWaitingSignaling({ timeoutMs: deps.getWaitSignalingTimeoutMs() });
      },
      emitLimitReachedAction: ({ context }) => {
        deps.emitLimitReached({ attempts: context.attempt });
      },
      registerAttemptStart: () => {
        deps.registerAttemptStart();
      },
      registerAttemptFinish: () => {
        deps.registerAttemptFinish();
      },
      resetAttemptsState: () => {
        deps.resetAttemptsState();
      },
      cancelAll: () => {
        deps.cancelAll();
      },
    },
  });
};

export { getAttemptingParameters };
