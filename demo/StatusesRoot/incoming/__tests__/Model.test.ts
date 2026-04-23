import { EIncomingStatus, type TIncomingContextMap } from '@/index';
import { IncomingStatusModel, INITIAL_INCOMING_STATUS_SNAPSHOT } from '../Model';

type TIncomingSnapshotByState<TState extends EIncomingStatus> = {
  state: TState;
  context: TIncomingContextMap[TState];
};

type TIncomingSnapshot = TIncomingSnapshotByState<EIncomingStatus>;

const createSnapshot = <TState extends EIncomingStatus>(
  state: TState,
  context: TIncomingContextMap[TState],
): TIncomingSnapshotByState<TState> => {
  return { state, context };
};

const unsafeSnapshot = (snapshot: unknown): TIncomingSnapshot => {
  return snapshot as TIncomingSnapshot;
};

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
  expectedDisplayName: string | undefined;
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
    expectedDisplayName: undefined,
  },
  {
    title: 'RINGING',
    snapshot: createSnapshot(EIncomingStatus.RINGING, {
      remoteCallerData,
      lastReason: undefined,
    }),
    expectedFlags: createExpectedFlags('isRinging'),
    expectedRemoteCallerData: remoteCallerData,
    expectedLastReason: undefined,
    expectedIncomingNumber: remoteCallerData.incomingNumber,
    expectedDisplayName: remoteCallerData.displayName,
  },
  {
    title: 'CONSUMED',
    snapshot: createSnapshot(EIncomingStatus.CONSUMED, {
      remoteCallerData,
      lastReason: EIncomingStatus.CONSUMED,
    }),
    expectedFlags: createExpectedFlags('isConsumed'),
    expectedRemoteCallerData: remoteCallerData,
    expectedLastReason: EIncomingStatus.CONSUMED,
    expectedIncomingNumber: remoteCallerData.incomingNumber,
    expectedDisplayName: remoteCallerData.displayName,
  },
  {
    title: 'DECLINED',
    snapshot: createSnapshot(EIncomingStatus.DECLINED, {
      remoteCallerData,
      lastReason: EIncomingStatus.DECLINED,
    }),
    expectedFlags: createExpectedFlags('isDeclined'),
    expectedRemoteCallerData: remoteCallerData,
    expectedLastReason: EIncomingStatus.DECLINED,
    expectedIncomingNumber: remoteCallerData.incomingNumber,
    expectedDisplayName: remoteCallerData.displayName,
  },
  {
    title: 'TERMINATED',
    snapshot: createSnapshot(EIncomingStatus.TERMINATED, {
      remoteCallerData,
      lastReason: EIncomingStatus.TERMINATED,
    }),
    expectedFlags: createExpectedFlags('isTerminated'),
    expectedRemoteCallerData: remoteCallerData,
    expectedLastReason: EIncomingStatus.TERMINATED,
    expectedIncomingNumber: remoteCallerData.incomingNumber,
    expectedDisplayName: remoteCallerData.displayName,
  },
  {
    title: 'FAILED',
    snapshot: createSnapshot(EIncomingStatus.FAILED, {
      remoteCallerData,
      lastReason: EIncomingStatus.FAILED,
    }),
    expectedFlags: createExpectedFlags('isFailed'),
    expectedRemoteCallerData: remoteCallerData,
    expectedLastReason: EIncomingStatus.FAILED,
    expectedIncomingNumber: remoteCallerData.incomingNumber,
    expectedDisplayName: remoteCallerData.displayName,
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
      expectedDisplayName,
    }) => {
      const status = createIncomingStatus(snapshot);

      expect(getStateFlags(status)).toEqual(expectedFlags);
      expect(status.remoteCallerData).toEqual(expectedRemoteCallerData);
      expect(status.terminalReason).toEqual(expectedLastReason);
      expect(status.incomingNumber).toEqual(expectedIncomingNumber);
      expect(status.displayName).toEqual(expectedDisplayName);
    },
  );

  it('returns undefined incomingNumber in IDLE state', () => {
    const status = createIncomingStatus(INITIAL_INCOMING_STATUS_SNAPSHOT);

    expect(status.remoteCallerData).toBeUndefined();
    expect(status.incomingNumber).toBeUndefined();
    expect(status.displayName).toBeUndefined();
  });

  describe('runtime negative cases (unsafe cast)', () => {
    it('returns undefined incomingNumber when RINGING has no remoteCallerData', () => {
      const status = createIncomingStatus(
        unsafeSnapshot({
          state: EIncomingStatus.RINGING,
          context: {
            lastReason: undefined,
          },
        }),
      );

      expect(status.remoteCallerData).toBeUndefined();
      expect(status.incomingNumber).toBeUndefined();
      expect(status.displayName).toBeUndefined();
    });
  });
});
