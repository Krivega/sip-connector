import { EPresentationStatus } from '@/index';
import {
  INITIAL_PRESENTATION_NODE_SNAPSHOT,
  PresentationNodeModel,
} from '../PresentationStatusesNode';

type TPresentationSnapshot = Parameters<typeof PresentationNodeModel.create>[0];

const createPresentationNode = (
  snapshot: TPresentationSnapshot = INITIAL_PRESENTATION_NODE_SNAPSHOT,
) => {
  return PresentationNodeModel.create(snapshot);
};

const getStateFlags = (node: ReturnType<typeof createPresentationNode>) => {
  return {
    hasIdle: node.hasIdle(),
    hasStarting: node.hasStarting(),
    hasActive: node.hasActive(),
    hasStopping: node.hasStopping(),
    hasFailed: node.hasFailed(),
  };
};

type TStateFlags = ReturnType<typeof getStateFlags>;
type TStateFlagKey = keyof TStateFlags;
type TStateCase = {
  title: string;
  snapshot: TPresentationSnapshot;
  expectedFlags: TStateFlags;
  expectedLastError: Error | undefined;
};

const createExpectedFlags = (activeFlag: TStateFlagKey): TStateFlags => {
  return {
    hasIdle: activeFlag === 'hasIdle',
    hasStarting: activeFlag === 'hasStarting',
    hasActive: activeFlag === 'hasActive',
    hasStopping: activeFlag === 'hasStopping',
    hasFailed: activeFlag === 'hasFailed',
  };
};

const stateCases: TStateCase[] = [
  {
    title: 'IDLE',
    snapshot: INITIAL_PRESENTATION_NODE_SNAPSHOT,
    expectedFlags: createExpectedFlags('hasIdle'),
    expectedLastError: undefined,
  },
  {
    title: 'STARTING',
    snapshot: {
      state: EPresentationStatus.STARTING,
      context: { lastError: undefined },
    } as TPresentationSnapshot,
    expectedFlags: createExpectedFlags('hasStarting'),
    expectedLastError: undefined,
  },
  {
    title: 'ACTIVE',
    snapshot: {
      state: EPresentationStatus.ACTIVE,
      context: { lastError: undefined },
    } as TPresentationSnapshot,
    expectedFlags: createExpectedFlags('hasActive'),
    expectedLastError: undefined,
  },
  {
    title: 'STOPPING',
    snapshot: {
      state: EPresentationStatus.STOPPING,
      context: { lastError: undefined },
    } as TPresentationSnapshot,
    expectedFlags: createExpectedFlags('hasStopping'),
    expectedLastError: undefined,
  },
  {
    title: 'FAILED',
    snapshot: {
      state: EPresentationStatus.FAILED,
      context: { lastError: new Error('screen failed') },
    } as TPresentationSnapshot,
    expectedFlags: createExpectedFlags('hasFailed'),
    expectedLastError: new Error('screen failed'),
  },
];

describe('PresentationNodeModel', () => {
  it('maps initial snapshot to nodeValue', () => {
    const node = createPresentationNode();

    expect(node.nodeValue).toEqual({
      state: EPresentationStatus.IDLE,
      context: {},
    });
  });

  it.each(stateCases)(
    'exposes state flags and lastError for $title',
    ({ snapshot, expectedFlags, expectedLastError }) => {
      const node = createPresentationNode(snapshot);

      expect(getStateFlags(node)).toEqual(expectedFlags);

      if (expectedLastError instanceof Error) {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(node.lastError).toBeInstanceOf(Error);
        // eslint-disable-next-line jest/no-conditional-expect
        expect((node.lastError as Error | undefined)?.message).toBe(expectedLastError.message);

        return;
      }

      expect(node.lastError).toBeUndefined();
    },
  );
});
