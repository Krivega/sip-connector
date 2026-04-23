import {
  EAutoConnectorStatus,
  type TAutoConnectorContextMap,
  type TParametersAutoConnect,
} from '@/index';
import { AutoConnectorStatusModel, INITIAL_AUTO_CONNECTOR_STATUS_SNAPSHOT } from '../Model';

type TAutoConnectorSnapshotByState<TState extends EAutoConnectorStatus> = {
  state: TState;
  context: TAutoConnectorContextMap[TState];
};

type TAutoConnectorSnapshot = TAutoConnectorSnapshotByState<EAutoConnectorStatus>;

const createSnapshot = <TState extends EAutoConnectorStatus>(
  state: TState,
  context: TAutoConnectorContextMap[TState],
): TAutoConnectorSnapshotByState<TState> => {
  return { state, context };
};

const unsafeSnapshot = (snapshot: unknown): TAutoConnectorSnapshot => {
  return snapshot as TAutoConnectorSnapshot;
};

const autoConnectParameters: TParametersAutoConnect = {
  getParameters: async () => {
    return {} as never;
  },
};

const createAutoConnectorStatus = (
  snapshot: TAutoConnectorSnapshot = INITIAL_AUTO_CONNECTOR_STATUS_SNAPSHOT,
) => {
  return AutoConnectorStatusModel.create(snapshot);
};

const getStateFlags = (status: ReturnType<typeof createAutoConnectorStatus>) => {
  return {
    isIdle: status.isIdle(),
    isDisconnecting: status.isDisconnecting(),
    isAttemptingGate: status.isAttemptingGate(),
    isAttemptingConnect: status.isAttemptingConnect(),
    isWaitingBeforeRetry: status.isWaitingBeforeRetry(),
    isConnectedMonitoring: status.isConnectedMonitoring(),
    isTelephonyChecking: status.isTelephonyChecking(),
    isErrorTerminal: status.isErrorTerminal(),
  };
};

type TStateFlags = ReturnType<typeof getStateFlags>;
type TStateFlagKey = keyof TStateFlags;
type TStateCase = {
  title: string;
  snapshot: TAutoConnectorSnapshot;
  expectedFlags: TStateFlags;
};

const createExpectedFlags = (activeFlag: TStateFlagKey): TStateFlags => {
  return {
    isIdle: activeFlag === 'isIdle',
    isDisconnecting: activeFlag === 'isDisconnecting',
    isAttemptingGate: activeFlag === 'isAttemptingGate',
    isAttemptingConnect: activeFlag === 'isAttemptingConnect',
    isWaitingBeforeRetry: activeFlag === 'isWaitingBeforeRetry',
    isConnectedMonitoring: activeFlag === 'isConnectedMonitoring',
    isTelephonyChecking: activeFlag === 'isTelephonyChecking',
    isErrorTerminal: activeFlag === 'isErrorTerminal',
  };
};

const stateCases: TStateCase[] = [
  {
    title: 'IDLE',
    snapshot: createSnapshot(EAutoConnectorStatus.IDLE, {
      afterDisconnect: 'idle',
      parameters: undefined,
      stopReason: undefined,
      lastError: undefined,
    }),
    expectedFlags: createExpectedFlags('isIdle'),
  },
  {
    title: 'DISCONNECTING',
    snapshot: createSnapshot(EAutoConnectorStatus.DISCONNECTING, {
      afterDisconnect: 'attempt',
      parameters: undefined,
      stopReason: undefined,
      lastError: undefined,
    }),
    expectedFlags: createExpectedFlags('isDisconnecting'),
  },
  {
    title: 'ATTEMPTING_GATE',
    snapshot: createSnapshot(EAutoConnectorStatus.ATTEMPTING_GATE, {
      afterDisconnect: 'attempt',
      parameters: autoConnectParameters,
      stopReason: undefined,
      lastError: undefined,
    }),
    expectedFlags: createExpectedFlags('isAttemptingGate'),
  },
  {
    title: 'ATTEMPTING_CONNECT',
    snapshot: createSnapshot(EAutoConnectorStatus.ATTEMPTING_CONNECT, {
      afterDisconnect: 'attempt',
      parameters: autoConnectParameters,
      stopReason: undefined,
      lastError: undefined,
    }),
    expectedFlags: createExpectedFlags('isAttemptingConnect'),
  },
  {
    title: 'WAITING_BEFORE_RETRY',
    snapshot: createSnapshot(EAutoConnectorStatus.WAITING_BEFORE_RETRY, {
      afterDisconnect: 'attempt',
      parameters: autoConnectParameters,
      stopReason: undefined,
      lastError: undefined,
    }),
    expectedFlags: createExpectedFlags('isWaitingBeforeRetry'),
  },
  {
    title: 'CONNECTED_MONITORING',
    snapshot: createSnapshot(EAutoConnectorStatus.CONNECTED_MONITORING, {
      afterDisconnect: 'attempt',
      parameters: autoConnectParameters,
      stopReason: undefined,
      lastError: undefined,
    }),
    expectedFlags: createExpectedFlags('isConnectedMonitoring'),
  },
  {
    title: 'TELEPHONY_CHECKING',
    snapshot: createSnapshot(EAutoConnectorStatus.TELEPHONY_CHECKING, {
      afterDisconnect: 'attempt',
      parameters: autoConnectParameters,
      stopReason: undefined,
      lastError: undefined,
    }),
    expectedFlags: createExpectedFlags('isTelephonyChecking'),
  },
  {
    title: 'ERROR_TERMINAL',
    snapshot: createSnapshot(EAutoConnectorStatus.ERROR_TERMINAL, {
      afterDisconnect: 'attempt',
      parameters: autoConnectParameters,
      stopReason: 'failed',
      lastError: new Error('auto connector failed'),
    }),
    expectedFlags: createExpectedFlags('isErrorTerminal'),
  },
];

describe('AutoConnectorStatusModel', () => {
  it('maps initial snapshot to snapshot', () => {
    const instance = createAutoConnectorStatus();

    expect(instance.snapshot).toEqual({
      state: EAutoConnectorStatus.IDLE,
      context: {},
    });
  });

  it.each(stateCases)(
    'exposes snapshot and state flags for $title',
    ({ snapshot, expectedFlags }) => {
      const instance = createAutoConnectorStatus(snapshot);

      expect(instance.snapshot).toEqual(snapshot);
      expect(getStateFlags(instance)).toEqual(expectedFlags);
    },
  );

  it.each(stateCases)('keeps only one active flag for $title', ({ snapshot }) => {
    const instance = createAutoConnectorStatus(snapshot);
    const flags = getStateFlags(instance);
    const activeFlagsCount = Object.values(flags).filter(Boolean).length;

    expect(activeFlagsCount).toBe(1);
  });

  describe('runtime negative cases (unsafe cast)', () => {
    it('keeps state flag behavior for incomplete context', () => {
      const instance = createAutoConnectorStatus(
        unsafeSnapshot({
          state: EAutoConnectorStatus.ATTEMPTING_CONNECT,
          context: {},
        }),
      );

      expect(instance.isAttemptingConnect()).toBe(true);
      expect(instance.isIdle()).toBe(false);
    });
  });
});
