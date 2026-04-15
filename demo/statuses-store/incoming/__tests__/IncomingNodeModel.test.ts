import { EIncomingStatus } from '@/index';
import { IncomingNodeModel, INITIAL_INCOMING_NODE_SNAPSHOT } from '../IncomingStatusesNode';

type TIncomingSnapshot = Parameters<typeof IncomingNodeModel.create>[0];

const createIncomingNode = (snapshot: TIncomingSnapshot = INITIAL_INCOMING_NODE_SNAPSHOT) => {
  return IncomingNodeModel.create(snapshot);
};

const getStateFlags = (node: ReturnType<typeof createIncomingNode>) => {
  return {
    hasIdle: node.hasIdle(),
    hasRinging: node.hasRinging(),
    hasConsumed: node.hasConsumed(),
    hasDeclined: node.hasDeclined(),
    hasTerminated: node.hasTerminated(),
    hasFailed: node.hasFailed(),
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
};

const createExpectedFlags = (activeFlag: TStateFlagKey): TStateFlags => {
  return {
    hasIdle: activeFlag === 'hasIdle',
    hasRinging: activeFlag === 'hasRinging',
    hasConsumed: activeFlag === 'hasConsumed',
    hasDeclined: activeFlag === 'hasDeclined',
    hasTerminated: activeFlag === 'hasTerminated',
    hasFailed: activeFlag === 'hasFailed',
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
    snapshot: INITIAL_INCOMING_NODE_SNAPSHOT,
    expectedFlags: createExpectedFlags('hasIdle'),
    expectedRemoteCallerData: undefined,
    expectedLastReason: undefined,
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
    expectedFlags: createExpectedFlags('hasRinging'),
    expectedRemoteCallerData: remoteCallerData,
    expectedLastReason: undefined,
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
    expectedFlags: createExpectedFlags('hasConsumed'),
    expectedRemoteCallerData: remoteCallerData,
    expectedLastReason: EIncomingStatus.CONSUMED,
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
    expectedFlags: createExpectedFlags('hasDeclined'),
    expectedRemoteCallerData: remoteCallerData,
    expectedLastReason: EIncomingStatus.DECLINED,
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
    expectedFlags: createExpectedFlags('hasTerminated'),
    expectedRemoteCallerData: remoteCallerData,
    expectedLastReason: EIncomingStatus.TERMINATED,
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
    expectedFlags: createExpectedFlags('hasFailed'),
    expectedRemoteCallerData: remoteCallerData,
    expectedLastReason: EIncomingStatus.FAILED,
  },
];

describe('IncomingNodeModel', () => {
  it('maps initial snapshot to nodeValue', () => {
    const node = createIncomingNode();

    expect(node.nodeValue).toEqual({
      state: EIncomingStatus.IDLE,
      context: {},
    });
  });

  it.each(stateCases)(
    'exposes state flags and context accessors for $title',
    ({ snapshot, expectedFlags, expectedRemoteCallerData, expectedLastReason }) => {
      const node = createIncomingNode(snapshot);

      expect(getStateFlags(node)).toEqual(expectedFlags);
      expect(node.remoteCallerData).toEqual(expectedRemoteCallerData);
      expect(node.lastReason).toEqual(expectedLastReason);
    },
  );
});
