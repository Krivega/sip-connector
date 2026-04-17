import { ESystemStatus } from '@/index';
import { INITIAL_SYSTEM_STATUS_SNAPSHOT, SystemStatusModel } from '../Model';

type TSystemSnapshot = Parameters<typeof SystemStatusModel.create>[0];

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
    snapshot: {
      state: ESystemStatus.DISCONNECTING,
    } as TSystemSnapshot,
    expectedFlags: createExpectedFlags('isDisconnecting'),
  },
  {
    title: 'CONNECTING',
    snapshot: {
      state: ESystemStatus.CONNECTING,
    } as TSystemSnapshot,
    expectedFlags: createExpectedFlags('isConnecting'),
  },
  {
    title: 'READY_TO_CALL',
    snapshot: {
      state: ESystemStatus.READY_TO_CALL,
    } as TSystemSnapshot,
    expectedFlags: createExpectedFlags('isReadyToCall'),
  },
  {
    title: 'CALL_CONNECTING',
    snapshot: {
      state: ESystemStatus.CALL_CONNECTING,
    } as TSystemSnapshot,
    expectedFlags: createExpectedFlags('isCallConnecting'),
  },
  {
    title: 'CALL_DISCONNECTING',
    snapshot: {
      state: ESystemStatus.CALL_DISCONNECTING,
    } as TSystemSnapshot,
    expectedFlags: createExpectedFlags('isCallDisconnecting'),
  },
  {
    title: 'CALL_ACTIVE',
    snapshot: {
      state: ESystemStatus.CALL_ACTIVE,
    } as TSystemSnapshot,
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
});
