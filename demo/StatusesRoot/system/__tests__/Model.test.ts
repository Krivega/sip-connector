import { ESystemStatus } from '@/index';
import { INITIAL_SYSTEM_STATUS_SNAPSHOT, SystemStatusModel } from '../Model';

type TSystemSnapshotByState<TState extends ESystemStatus> = {
  state: TState;
};

type TSystemSnapshot = TSystemSnapshotByState<ESystemStatus>;

const createSnapshot = <TState extends ESystemStatus>(
  state: TState,
): TSystemSnapshotByState<TState> => {
  return { state };
};

const unsafeSnapshot = (snapshot: unknown): TSystemSnapshot => {
  return snapshot as TSystemSnapshot;
};

const createSystemStatus = (snapshot: TSystemSnapshot = INITIAL_SYSTEM_STATUS_SNAPSHOT) => {
  return SystemStatusModel.create(snapshot);
};

const getStateFlags = (status: ReturnType<typeof createSystemStatus>) => {
  return {
    isDisconnected: status.isDisconnected(),
    isDisconnecting: status.isDisconnecting(),
    isConnecting: status.isConnecting(),
    isReadyToCall: status.isReadyToCall(),
    isCallConnecting: status.isCallConnecting(),
    isCallDisconnecting: status.isCallDisconnecting(),
    isCallActive: status.isCallActive(),
  };
};

type TStateFlags = ReturnType<typeof getStateFlags>;
type TStateFlagKey = keyof TStateFlags;
type TStateCase = {
  title: string;
  snapshot: TSystemSnapshot;
  expectedFlags: TStateFlags;
};

const createExpectedFlags = (activeFlag: TStateFlagKey): TStateFlags => {
  return {
    isDisconnected: activeFlag === 'isDisconnected',
    isDisconnecting: activeFlag === 'isDisconnecting',
    isConnecting: activeFlag === 'isConnecting',
    isReadyToCall: activeFlag === 'isReadyToCall',
    isCallConnecting: activeFlag === 'isCallConnecting',
    isCallDisconnecting: activeFlag === 'isCallDisconnecting',
    isCallActive: activeFlag === 'isCallActive',
  };
};

const stateCases: TStateCase[] = [
  {
    title: 'DISCONNECTED',
    snapshot: INITIAL_SYSTEM_STATUS_SNAPSHOT,
    expectedFlags: createExpectedFlags('isDisconnected'),
  },
  {
    title: 'DISCONNECTING',
    snapshot: createSnapshot(ESystemStatus.DISCONNECTING),
    expectedFlags: createExpectedFlags('isDisconnecting'),
  },
  {
    title: 'CONNECTING',
    snapshot: createSnapshot(ESystemStatus.CONNECTING),
    expectedFlags: createExpectedFlags('isConnecting'),
  },
  {
    title: 'READY_TO_CALL',
    snapshot: createSnapshot(ESystemStatus.READY_TO_CALL),
    expectedFlags: createExpectedFlags('isReadyToCall'),
  },
  {
    title: 'CALL_CONNECTING',
    snapshot: createSnapshot(ESystemStatus.CALL_CONNECTING),
    expectedFlags: createExpectedFlags('isCallConnecting'),
  },
  {
    title: 'CALL_DISCONNECTING',
    snapshot: createSnapshot(ESystemStatus.CALL_DISCONNECTING),
    expectedFlags: createExpectedFlags('isCallDisconnecting'),
  },
  {
    title: 'CALL_ACTIVE',
    snapshot: createSnapshot(ESystemStatus.CALL_ACTIVE),
    expectedFlags: createExpectedFlags('isCallActive'),
  },
];

describe('SystemStatusModel', () => {
  it('maps initial snapshot to snapshot', () => {
    const status = createSystemStatus();

    expect(status.snapshot).toEqual({
      state: ESystemStatus.DISCONNECTED,
    });
  });

  it.each(stateCases)('exposes state flags for $title', ({ snapshot, expectedFlags }) => {
    const status = createSystemStatus(snapshot);

    expect(getStateFlags(status)).toEqual(expectedFlags);
  });

  describe('runtime negative cases (unsafe cast)', () => {
    it('throws on unknown state value', () => {
      expect(() => {
        createSystemStatus(unsafeSnapshot({ state: 'broken-state' }));
      }).toThrow();
    });
  });
});
