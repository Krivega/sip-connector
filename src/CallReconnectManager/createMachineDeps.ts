import type { CallReconnectRuntime } from './CallReconnectRuntime';
import type { TCallReconnectMachineDeps } from './CallReconnectStateMachine';
import type { TEvents } from './events';

type TCreateMachineDepsParameters = {
  runtime: CallReconnectRuntime;
  events: TEvents;
};

/**
 * Склейка машины с runtime: машина работает с тонким slim-интерфейсом `TCallReconnectMachineDeps`,
 * а runtime держит всё состояние и сайд-эффекты. Здесь маршрутизируем события из `actions`
 * через `events`, чтобы декларативный автомат не знал про `TypedEvents`.
 */
export const createMachineDeps = (
  parameters: TCreateMachineDepsParameters,
): TCallReconnectMachineDeps => {
  const { runtime, events } = parameters;

  return {
    isNetworkFailure: (event) => {
      return runtime.isNetworkFailure(event);
    },
    canRetryOnError: (error) => {
      return runtime.canRetryOnError(error);
    },
    isSignalingReady: () => {
      return runtime.isSignalingReady();
    },
    hasLimitReached: () => {
      return runtime.hasLimitReached();
    },
    computeNextDelayMs: (attempt) => {
      return runtime.computeNextDelayMs(attempt);
    },
    delayBeforeAttempt: async (nextDelayMs) => {
      await runtime.delayBeforeAttempt(nextDelayMs);
    },
    waitSignalingReady: async () => {
      await runtime.waitSignalingReady();
    },
    performAttempt: async (callParameters) => {
      await runtime.performAttempt(callParameters);
    },
    registerAttemptStart: () => {
      runtime.registerAttemptStart();
    },
    registerAttemptFinish: () => {
      runtime.registerAttemptFinish();
    },
    resetAttemptsState: () => {
      runtime.resetAttemptsState();
    },
    emitArmed: () => {
      events.trigger('armed', {});
    },
    emitDisarmed: () => {
      events.trigger('disarmed', {});
    },
    emitFailureDetected: (payload) => {
      events.trigger('failure-detected', payload);
    },
    emitAttemptScheduled: (payload) => {
      events.trigger('attempt-scheduled', payload);
    },
    emitAttemptStarted: (payload) => {
      events.trigger('attempt-started', payload);
    },
    emitAttemptSucceeded: (payload) => {
      events.trigger('attempt-succeeded', payload);
    },
    emitAttemptFailed: (payload) => {
      events.trigger('attempt-failed', payload);
    },
    emitWaitingSignaling: (payload) => {
      events.trigger('waiting-signaling', payload);
    },
    emitLimitReached: (payload) => {
      events.trigger('limit-reached', payload);
    },
    emitCancelled: (payload) => {
      events.trigger('cancelled', payload);
    },
    cancelAll: () => {
      runtime.cancelAll();
    },
    getWaitSignalingTimeoutMs: () => {
      return runtime.getWaitSignalingTimeoutMs();
    },
  };
};
