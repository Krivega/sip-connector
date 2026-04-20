import { EIncomingStatus } from '@/index';
import { IncomingStatusModel, INITIAL_INCOMING_STATUS_SNAPSHOT } from '../Model';

type TIncomingSnapshot = Parameters<typeof IncomingStatusModel.create>[0];

const createIncomingStatus = (snapshot: TIncomingSnapshot = INITIAL_INCOMING_STATUS_SNAPSHOT) => {
  return IncomingStatusModel.create(snapshot);
};

const getStateFlags = (status: ReturnType<typeof createIncomingStatus>) => {
  return {
    isIdle: status.isIdle(),
    isRinging: status.isRinging(),
    isConsumed: status.isConsumed(),
    isDeclined: status.isDeclined(),
    isTerminated: status.isTerminated(),
    isFailed: status.isFailed(),
  };
};

type TStateFlags = ReturnType<typeof getStateFlags>;
type TStateFlagKey = keyof TStateFlags;
type TStateCase = {
  title: string;
  snapshot: TIncomingSnapshot;
  expectedFlags: TStateFlags;
  expectedRemoteCallerData:
    | {
        incomingNumber: string;
        displayName: string;
        host: string;
        rtcSession: never;
      }
    | undefined;
  expectedLastReason: EIncomingStatus | undefined;
  expectedIncomingNumber: string | undefined;
};

const createExpectedFlags = (activeFlag: TStateFlagKey): TStateFlags => {
  return {
    isIdle: activeFlag === 'isIdle',
    isRinging: activeFlag === 'isRinging',
    isConsumed: activeFlag === 'isConsumed',
    isDeclined: activeFlag === 'isDeclined',
    isTerminated: activeFlag === 'isTerminated',
    isFailed: activeFlag === 'isFailed',
  };
};

const remoteCallerData = {
  incomingNumber: '100',
  displayName: 'Test caller',
  host: 'example.com',
  rtcSession: {} as never,
};

const stateCases: TStateCase[] = [
  {
    title: 'IDLE',
    snapshot: INITIAL_INCOMING_STATUS_SNAPSHOT,
    expectedFlags: createExpectedFlags('isIdle'),
    expectedRemoteCallerData: undefined,
    expectedLastReason: undefined,
    expectedIncomingNumber: undefined,
  },
  {
    title: 'RINGING',
    snapshot: {
      state: EIncomingStatus.RINGING,
      context: {
        remoteCallerData,
        lastReason: undefined,
      },
    } as TIncomingSnapshot,
    expectedFlags: createExpectedFlags('isRinging'),
    expectedRemoteCallerData: remoteCallerData,
    expectedLastReason: undefined,
    expectedIncomingNumber: remoteCallerData.incomingNumber,
  },
  {
    title: 'CONSUMED',
    snapshot: {
      state: EIncomingStatus.CONSUMED,
      context: {
        remoteCallerData,
        lastReason: EIncomingStatus.CONSUMED,
      },
    } as TIncomingSnapshot,
    expectedFlags: createExpectedFlags('isConsumed'),
    expectedRemoteCallerData: remoteCallerData,
    expectedLastReason: EIncomingStatus.CONSUMED,
    expectedIncomingNumber: remoteCallerData.incomingNumber,
  },
  {
    title: 'DECLINED',
    snapshot: {
      state: EIncomingStatus.DECLINED,
      context: {
        remoteCallerData,
        lastReason: EIncomingStatus.DECLINED,
      },
    } as TIncomingSnapshot,
    expectedFlags: createExpectedFlags('isDeclined'),
    expectedRemoteCallerData: remoteCallerData,
    expectedLastReason: EIncomingStatus.DECLINED,
    expectedIncomingNumber: remoteCallerData.incomingNumber,
  },
  {
    title: 'TERMINATED',
    snapshot: {
      state: EIncomingStatus.TERMINATED,
      context: {
        remoteCallerData,
        lastReason: EIncomingStatus.TERMINATED,
      },
    } as TIncomingSnapshot,
    expectedFlags: createExpectedFlags('isTerminated'),
    expectedRemoteCallerData: remoteCallerData,
    expectedLastReason: EIncomingStatus.TERMINATED,
    expectedIncomingNumber: remoteCallerData.incomingNumber,
  },
  {
    title: 'FAILED',
    snapshot: {
      state: EIncomingStatus.FAILED,
      context: {
        remoteCallerData,
        lastReason: EIncomingStatus.FAILED,
      },
    } as TIncomingSnapshot,
    expectedFlags: createExpectedFlags('isFailed'),
    expectedRemoteCallerData: remoteCallerData,
    expectedLastReason: EIncomingStatus.FAILED,
    expectedIncomingNumber: remoteCallerData.incomingNumber,
  },
];

describe('IncomingStatusModel', () => {
  it('maps initial snapshot to snapshot', () => {
    const status = createIncomingStatus();

    expect(status.snapshot).toEqual({
      state: EIncomingStatus.IDLE,
      context: {},
    });
  });

  it.each(stateCases)(
    'exposes state flags and context accessors for $title',
    ({
      snapshot,
      expectedFlags,
      expectedRemoteCallerData,
      expectedLastReason,
      expectedIncomingNumber,
    }) => {
      const status = createIncomingStatus(snapshot);

      expect(getStateFlags(status)).toEqual(expectedFlags);
      expect(status.remoteCallerData).toEqual(expectedRemoteCallerData);
      expect(status.terminalReason).toEqual(expectedLastReason);
      expect(status.incomingNumber).toEqual(expectedIncomingNumber);
    },
  );

  it('returns undefined incomingNumber when context has no remoteCallerData', () => {
    const status = createIncomingStatus({
      state: EIncomingStatus.RINGING,
      context: {
        lastReason: undefined,
      },
    } as TIncomingSnapshot);

    expect(status.remoteCallerData).toBeUndefined();
    expect(status.incomingNumber).toBeUndefined();
  });
});
