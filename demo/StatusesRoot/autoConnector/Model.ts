import { types } from 'mobx-state-tree';

import { EAutoConnectorStatus as EState } from '@/index';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type {
  TAutoConnectorContextMap,
  TAutoConnectorSnapshot as TSnapshot,
  TSessionSnapshot,
} from '@/index';

export type TAutoConnectorStopReason = 'halted' | 'cancelled' | 'failed';

type TSnapshotByState<TState extends EState> = TState extends EState
  ? Extract<TSnapshot, { value: TState }> extends { context: infer TContext }
    ? { state: TState; context: TContext }
    : never
  : never;

export type TAutoConnectorStatusSnapshot = TSnapshotByState<EState>;

export const createAutoConnectorStatusSnapshotFromSession = (
  snapshot: TSessionSnapshot,
): TSnapshotByState<EState> => {
  const state = snapshot.autoConnector.value;
  const { context } = snapshot.autoConnector;

  return {
    state,
    context,
  } as TAutoConnectorStatusSnapshot;
};

export const AutoConnectorStatusModel = types
  .model({
    state: types.enumeration('AutoConnectorStatus', [
      EState.IDLE,
      EState.DISCONNECTING,
      EState.ATTEMPTING_GATE,
      EState.ATTEMPTING_CONNECT,
      EState.WAITING_BEFORE_RETRY,
      EState.CONNECTED_MONITORING,
      EState.TELEPHONY_CHECKING,
      EState.ERROR_TERMINAL,
    ]),
    context: types.frozen<TAutoConnectorContextMap[EState]>(),
  })
  .views((self) => {
    return {
      get snapshot(): TSnapshotByState<EState> {
        return { state: self.state, context: self.context } as TAutoConnectorStatusSnapshot;
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
      isDisconnecting: (): boolean => {
        return hasState(EState.DISCONNECTING);
      },
      isAttemptingGate: (): boolean => {
        return hasState(EState.ATTEMPTING_GATE);
      },
      isAttemptingConnect: (): boolean => {
        return hasState(EState.ATTEMPTING_CONNECT);
      },
      isWaitingBeforeRetry: (): boolean => {
        return hasState(EState.WAITING_BEFORE_RETRY);
      },
      isConnectedMonitoring: (): boolean => {
        return hasState(EState.CONNECTED_MONITORING);
      },
      isTelephonyChecking: (): boolean => {
        return hasState(EState.TELEPHONY_CHECKING);
      },
      isErrorTerminal: (): boolean => {
        return hasState(EState.ERROR_TERMINAL);
      },
    };
  });

export type TAutoConnectorStatusInstance = Instance<typeof AutoConnectorStatusModel>;

export const INITIAL_AUTO_CONNECTOR_STATUS_SNAPSHOT = {
  state: EState.IDLE,
  context: {},
} as SnapshotIn<typeof AutoConnectorStatusModel>;
