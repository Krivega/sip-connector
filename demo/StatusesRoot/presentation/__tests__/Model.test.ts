import { EPresentationStatus } from '@/index';
import { INITIAL_PRESENTATION_STATUS_SNAPSHOT, PresentationStatusModel } from '../Model';

type TPresentationSnapshot = Parameters<typeof PresentationStatusModel.create>[0];

const createPresentationStatus = (
  snapshot: TPresentationSnapshot = INITIAL_PRESENTATION_STATUS_SNAPSHOT,
) => {
  return PresentationStatusModel.create(snapshot);
};

const getStateFlags = (instance: ReturnType<typeof createPresentationStatus>) => {
  return {
    isIdle: instance.isIdle(),
    isStarting: instance.isStarting(),
    isActive: instance.isActive(),
    isStopping: instance.isStopping(),
    isFailed: instance.isFailed(),
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
    isIdle: activeFlag === 'isIdle',
    isStarting: activeFlag === 'isStarting',
    isActive: activeFlag === 'isActive',
    isStopping: activeFlag === 'isStopping',
    isFailed: activeFlag === 'isFailed',
  };
};

const stateCases: TStateCase[] = [
  {
    title: 'IDLE',
    snapshot: INITIAL_PRESENTATION_STATUS_SNAPSHOT,
    expectedFlags: createExpectedFlags('isIdle'),
    expectedLastError: undefined,
  },
  {
    title: 'STARTING',
    snapshot: {
      state: EPresentationStatus.STARTING,
      context: { lastError: undefined },
    } as TPresentationSnapshot,
    expectedFlags: createExpectedFlags('isStarting'),
    expectedLastError: undefined,
  },
  {
    title: 'ACTIVE',
    snapshot: {
      state: EPresentationStatus.ACTIVE,
      context: { lastError: undefined },
    } as TPresentationSnapshot,
    expectedFlags: createExpectedFlags('isActive'),
    expectedLastError: undefined,
  },
  {
    title: 'STOPPING',
    snapshot: {
      state: EPresentationStatus.STOPPING,
      context: { lastError: undefined },
    } as TPresentationSnapshot,
    expectedFlags: createExpectedFlags('isStopping'),
    expectedLastError: undefined,
  },
  {
    title: 'FAILED',
    snapshot: {
      state: EPresentationStatus.FAILED,
      context: { lastError: new Error('screen failed') },
    } as TPresentationSnapshot,
    expectedFlags: createExpectedFlags('isFailed'),
    expectedLastError: new Error('screen failed'),
  },
];

describe('PresentationStatusModel', () => {
  it('maps initial snapshot to snapshot', () => {
    const instance = createPresentationStatus();

    expect(instance.snapshot).toEqual({
      state: EPresentationStatus.IDLE,
      context: {},
    });
  });

  it.each(stateCases)(
    'exposes state flags and lastError for $title',
    ({ snapshot, expectedFlags, expectedLastError }) => {
      const instance = createPresentationStatus(snapshot);

      expect(getStateFlags(instance)).toEqual(expectedFlags);

      if (expectedLastError instanceof Error) {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(instance.lastError).toBeInstanceOf(Error);
        // eslint-disable-next-line jest/no-conditional-expect
        expect((instance.lastError as Error | undefined)?.message).toBe(expectedLastError.message);

        return;
      }

      expect(instance.lastError).toBeUndefined();
    },
  );
});
