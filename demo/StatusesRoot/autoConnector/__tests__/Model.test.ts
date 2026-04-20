import { EAutoConnectorStatus } from '@/index';
import { AutoConnectorStatusModel, INITIAL_AUTO_CONNECTOR_STATUS_SNAPSHOT } from '../Model';

type TAutoConnectorSnapshot = Parameters<typeof AutoConnectorStatusModel.create>[0];

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
    snapshot: {
      state: EAutoConnectorStatus.IDLE,
      context: {
        stopReason: 'halted',
      },
    } as TAutoConnectorSnapshot,
    expectedFlags: createExpectedFlags('isIdle'),
  },
  {
    title: 'DISCONNECTING',
    snapshot: {
      state: EAutoConnectorStatus.DISCONNECTING,
      context: {
        afterDisconnect: 'attempt',
        stopReason: 'cancelled',
      },
    } as TAutoConnectorSnapshot,
    expectedFlags: createExpectedFlags('isDisconnecting'),
  },
  {
    title: 'ATTEMPTING_GATE',
    snapshot: {
      state: EAutoConnectorStatus.ATTEMPTING_GATE,
      context: {},
    } as TAutoConnectorSnapshot,
    expectedFlags: createExpectedFlags('isAttemptingGate'),
  },
  {
    title: 'ATTEMPTING_CONNECT',
    snapshot: {
      state: EAutoConnectorStatus.ATTEMPTING_CONNECT,
      context: {},
    } as TAutoConnectorSnapshot,
    expectedFlags: createExpectedFlags('isAttemptingConnect'),
  },
  {
    title: 'WAITING_BEFORE_RETRY',
    snapshot: {
      state: EAutoConnectorStatus.WAITING_BEFORE_RETRY,
      context: {},
    } as TAutoConnectorSnapshot,
    expectedFlags: createExpectedFlags('isWaitingBeforeRetry'),
  },
  {
    title: 'CONNECTED_MONITORING',
    snapshot: {
      state: EAutoConnectorStatus.CONNECTED_MONITORING,
      context: {},
    } as TAutoConnectorSnapshot,
    expectedFlags: createExpectedFlags('isConnectedMonitoring'),
  },
  {
    title: 'TELEPHONY_CHECKING',
    snapshot: {
      state: EAutoConnectorStatus.TELEPHONY_CHECKING,
      context: {},
    } as TAutoConnectorSnapshot,
    expectedFlags: createExpectedFlags('isTelephonyChecking'),
  },
  {
    title: 'ERROR_TERMINAL',
    snapshot: {
      state: EAutoConnectorStatus.ERROR_TERMINAL,
      context: {
        stopReason: 'failed',
        lastError: new Error('auto connector failed'),
      },
    } as TAutoConnectorSnapshot,
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
});
