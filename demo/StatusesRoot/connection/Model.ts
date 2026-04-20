import { types } from 'mobx-state-tree';

import { EConnectionStatus as EState, sessionSelectors } from '@/index';

import type { Instance, SnapshotIn } from 'mobx-state-tree';
import type {
  TConnectionContextMap,
  TConnectionSnapshot as TSnapshot,
  TSessionSnapshot,
} from '@/index';

type TSnapshotByState<TState extends EState> = TState extends EState
  ? Extract<TSnapshot, { value: TState }> extends { context: infer TContext }
    ? { state: TState; context: TContext }
    : never
  : never;

export type TConnectionStatusSnapshot = TSnapshotByState<EState>;

export const createConnectionStatusSnapshotFromSession = (
  snapshot: TSessionSnapshot,
): TSnapshotByState<EState> => {
  const state = sessionSelectors.selectConnectionStatus(snapshot);
  const {
    connection: { context },
  } = snapshot;

  return {
    state,
    context,
  } as TConnectionStatusSnapshot;
};

export const ConnectionStatusModel = types
  .model({
    state: types.enumeration('ConnectionStatus', [
      EState.IDLE,
      EState.PREPARING,
      EState.CONNECTING,
      EState.CONNECTED,
      EState.REGISTERED,
      EState.ESTABLISHED,
      EState.DISCONNECTING,
      EState.DISCONNECTED,
    ]),
    context: types.frozen<TConnectionContextMap[EState]>(),
  })
  .views((self) => {
    return {
      get snapshot(): TSnapshotByState<EState> {
        return { state: self.state, context: self.context } as TConnectionStatusSnapshot;
      },
    };
  })
  .views((self) => {
    return {
      isIdle: (): boolean => {
        return self.state === EState.IDLE;
      },
      isPreparing: (): boolean => {
        return self.state === EState.PREPARING;
      },
      isConnecting: (): boolean => {
        return self.state === EState.CONNECTING;
      },
      isConnected: (): boolean => {
        return self.state === EState.CONNECTED;
      },
      isRegistered: (): boolean => {
        return self.state === EState.REGISTERED;
      },
      isEstablished: (): boolean => {
        return self.state === EState.ESTABLISHED;
      },
      isDisconnecting: (): boolean => {
        return self.state === EState.DISCONNECTING;
      },
      isDisconnected: (): boolean => {
        return self.state === EState.DISCONNECTED;
      },
    };
  })
  .views((self) => {
    return {
      get connectionConfig(): TConnectionContextMap[EState]['connectionConfiguration'] {
        return self.context.connectionConfiguration;
      },
    };
  })
  .views((self) => {
    return {
      get userIdentity(): { user: string; displayName: string | undefined } | undefined {
        const { connectionConfig } = self;

        if (connectionConfig?.user !== undefined) {
          const { displayName, user } = connectionConfig;

          return { user, displayName };
        }

        return undefined;
      },

      get user(): string | undefined {
        return self.connectionConfig?.user;
      },

      get displayName(): string | undefined {
        return self.connectionConfig?.displayName;
      },
    };
  });

export type TConnectionStatusInstance = Instance<typeof ConnectionStatusModel>;

export const INITIAL_CONNECTION_STATUS_SNAPSHOT = {
  state: EState.IDLE,
  context: {},
} as SnapshotIn<typeof ConnectionStatusModel>;
