import { types } from 'mobx-state-tree';

import { ECallReconnectStatus as EState } from '@/index';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type { TCallReconnectContextMap, TSessionSnapshot } from '@/index';

/**
 * Snapshot модели — узкая выборка из снапшота XState-машины `CallReconnect`.
 * Храним `state` + `context` (в сыром виде через `types.frozen`), чтобы удобно
 * отрисовывать в UI и подписываться на изменения через MobX.
 */
export type TSnapshotByState<TState extends EState> = {
  state: TState;
  context: TCallReconnectContextMap[TState];
};

export type TCallReconnectStatusSnapshot = TSnapshotByState<EState>;

export const createCallReconnectStatusSnapshotFromSession = (
  snapshot: TSessionSnapshot,
): TSnapshotByState<EState> => {
  const state = snapshot.callReconnect.value;
  const { context } = snapshot.callReconnect;

  return {
    state,
    context,
  } as TCallReconnectStatusSnapshot;
};

export const CallReconnectStatusModel = types
  .model({
    state: types.enumeration('CallReconnectStatus', [
      EState.IDLE,
      EState.ARMED,
      EState.EVALUATING,
      EState.BACKOFF,
      EState.WAITING_SIGNALING,
      EState.ATTEMPTING,
      EState.LIMIT_REACHED,
      EState.ERROR_TERMINAL,
    ]),
    context: types.frozen<TCallReconnectContextMap[EState]>(),
  })
  .views((self) => {
    return {
      get snapshot(): TSnapshotByState<EState> {
        return {
          state: self.state,
          context: self.context,
        } as TCallReconnectStatusSnapshot;
      },
    };
  })
  .views((self) => {
    const hasState = (state: EState): boolean => {
      return self.state === state;
    };

    return {
      isIdle: (): boolean => {
        return hasState(EState.IDLE);
      },
      isArmed: (): boolean => {
        return hasState(EState.ARMED);
      },
      isEvaluating: (): boolean => {
        return hasState(EState.EVALUATING);
      },
      isBackoff: (): boolean => {
        return hasState(EState.BACKOFF);
      },
      isWaitingSignaling: (): boolean => {
        return hasState(EState.WAITING_SIGNALING);
      },
      isAttempting: (): boolean => {
        return hasState(EState.ATTEMPTING);
      },
      isLimitReached: (): boolean => {
        return hasState(EState.LIMIT_REACHED);
      },
      isErrorTerminal: (): boolean => {
        return hasState(EState.ERROR_TERMINAL);
      },
    };
  })
  .views((self) => {
    return {
      /**
       * Показывать ли баннер `#callReconnectIndicator`: активный ретрай или финальная ошибка.
       */
      get isReconnectIndicatorVisible(): boolean {
        return this.isReconnecting() || self.isErrorTerminal();
      },
      /**
       * UI-флаг: показывать ли индикатор «переподключение».
       * Истинно, когда машина не в `idle` и не в `armed` (т.е. активно борется с обрывом).
       */
      isReconnecting: (): boolean => {
        return !self.isIdle() && !self.isArmed() && !self.isErrorTerminal();
      },
    };
  })
  .views((self) => {
    return {
      get attempt(): number {
        return self.context.attempt;
      },

      get nextDelayMs(): number {
        return self.context.nextDelayMs;
      },

      get lastFailureCause(): string | undefined {
        return self.context.lastFailureCause;
      },

      get lastError() {
        return self.context.lastError;
      },

      get cancelledReason() {
        return self.context.cancelledReason;
      },
    };
  });

export type TCallReconnectStatusInstance = Instance<typeof CallReconnectStatusModel>;

export const INITIAL_CALL_RECONNECT_STATUS_SNAPSHOT = {
  state: EState.IDLE,
  context: {},
} as SnapshotIn<typeof CallReconnectStatusModel>;
