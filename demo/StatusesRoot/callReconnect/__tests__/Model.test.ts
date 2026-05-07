import {
  ECallReconnectStatus,
  type TCallReconnectContextMap,
  type TCallRedialParameters,
} from '@/index';
import { CallReconnectStatusModel, INITIAL_CALL_RECONNECT_STATUS_SNAPSHOT } from '../Model';

type TCallReconnectSnapshotByState<TState extends ECallReconnectStatus> = {
  state: TState;
  context: TCallReconnectContextMap[TState];
};

type TCallReconnectSnapshot = TCallReconnectSnapshotByState<ECallReconnectStatus>;

const redialParameters: TCallRedialParameters = {
  getCallParameters: async () => {
    return {} as never;
  },
};

const createDefaultContext = <TState extends ECallReconnectStatus>(
  state: TState,
): TCallReconnectContextMap[TState] => {
  if (state === ECallReconnectStatus.IDLE) {
    return {
      parameters: undefined,
      attempt: 0,
      nextDelayMs: 0,
      lastError: undefined,
      lastFailureCause: undefined,
      cancelledReason: undefined,
    } as TCallReconnectContextMap[TState];
  }

  return {
    parameters: redialParameters,
    attempt: 1,
    nextDelayMs: 1000,
    lastError: undefined,
    lastFailureCause: undefined,
    cancelledReason: undefined,
  } as TCallReconnectContextMap[TState];
};

const createSnapshot = <TState extends ECallReconnectStatus>(
  state: TState,
  context: TCallReconnectContextMap[TState],
): TCallReconnectSnapshotByState<TState> => {
  return { state, context };
};

const unsafeSnapshot = (snapshot: unknown): TCallReconnectSnapshot => {
  return snapshot as TCallReconnectSnapshot;
};

describe('CallReconnectStatusModel', () => {
  const createInstance = (
    snapshot: TCallReconnectSnapshot = INITIAL_CALL_RECONNECT_STATUS_SNAPSHOT,
  ) => {
    return CallReconnectStatusModel.create(snapshot);
  };

  const getStateFlags = (status: ReturnType<typeof createInstance>) => {
    return {
      isIdle: status.isIdle(),
      isArmed: status.isArmed(),
      isEvaluating: status.isEvaluating(),
      isBackoff: status.isBackoff(),
      isWaitingSignaling: status.isWaitingSignaling(),
      isAttempting: status.isAttempting(),
      isLimitReached: status.isLimitReached(),
      isErrorTerminal: status.isErrorTerminal(),
    };
  };

  type TStateFlags = ReturnType<typeof getStateFlags>;
  type TStateFlagKey = keyof TStateFlags;

  const createExpectedFlags = (activeFlag: TStateFlagKey): TStateFlags => {
    return {
      isIdle: activeFlag === 'isIdle',
      isArmed: activeFlag === 'isArmed',
      isEvaluating: activeFlag === 'isEvaluating',
      isBackoff: activeFlag === 'isBackoff',
      isWaitingSignaling: activeFlag === 'isWaitingSignaling',
      isAttempting: activeFlag === 'isAttempting',
      isLimitReached: activeFlag === 'isLimitReached',
      isErrorTerminal: activeFlag === 'isErrorTerminal',
    };
  };

  it('maps initial snapshot', () => {
    const instance = createInstance();

    expect(instance.snapshot).toEqual({
      state: ECallReconnectStatus.IDLE,
      context: {},
    });
    expect(instance.isReconnecting()).toBe(false);
    expect(getStateFlags(instance)).toEqual(createExpectedFlags('isIdle'));
    expect(instance.isReconnectIndicatorVisible).toBe(false);
    expect(instance.attempt).toBeUndefined();
    expect(instance.nextDelayMs).toBeUndefined();
  });

  it.each([
    ECallReconnectStatus.IDLE,
    ECallReconnectStatus.ARMED,
    ECallReconnectStatus.ERROR_TERMINAL,
  ])('%s -> isReconnecting=false', (state) => {
    const instance = createInstance(createSnapshot(state, createDefaultContext(state)));

    expect(instance.isReconnecting()).toBe(false);
  });

  it.each([
    ECallReconnectStatus.EVALUATING,
    ECallReconnectStatus.BACKOFF,
    ECallReconnectStatus.WAITING_SIGNALING,
    ECallReconnectStatus.ATTEMPTING,
    ECallReconnectStatus.LIMIT_REACHED,
  ])('%s -> isReconnecting=true', (state) => {
    const instance = createInstance(createSnapshot(state, createDefaultContext(state)));

    expect(instance.isReconnecting()).toBe(true);
  });

  it.each([
    { state: ECallReconnectStatus.IDLE, flag: 'isIdle' as const },
    { state: ECallReconnectStatus.ARMED, flag: 'isArmed' as const },
    { state: ECallReconnectStatus.EVALUATING, flag: 'isEvaluating' as const },
    { state: ECallReconnectStatus.BACKOFF, flag: 'isBackoff' as const },
    { state: ECallReconnectStatus.WAITING_SIGNALING, flag: 'isWaitingSignaling' as const },
    { state: ECallReconnectStatus.ATTEMPTING, flag: 'isAttempting' as const },
    { state: ECallReconnectStatus.LIMIT_REACHED, flag: 'isLimitReached' as const },
    { state: ECallReconnectStatus.ERROR_TERMINAL, flag: 'isErrorTerminal' as const },
  ])('state $state exposes only $flag', ({ state, flag }) => {
    const instance = createInstance(createSnapshot(state, createDefaultContext(state)));

    expect(getStateFlags(instance)).toEqual(createExpectedFlags(flag));
  });

  it.each([
    { state: ECallReconnectStatus.IDLE, visible: false },
    { state: ECallReconnectStatus.ARMED, visible: false },
    { state: ECallReconnectStatus.EVALUATING, visible: true },
    { state: ECallReconnectStatus.BACKOFF, visible: true },
    { state: ECallReconnectStatus.WAITING_SIGNALING, visible: true },
    { state: ECallReconnectStatus.ATTEMPTING, visible: true },
    { state: ECallReconnectStatus.LIMIT_REACHED, visible: true },
    { state: ECallReconnectStatus.ERROR_TERMINAL, visible: true },
  ])('isReconnectIndicatorVisible for $state', ({ state, visible }) => {
    const instance = createInstance(createSnapshot(state, createDefaultContext(state)));

    expect(instance.isReconnectIndicatorVisible).toBe(visible);
  });

  it('reads attempt and nextDelayMs from context', () => {
    const instance = createInstance(
      createSnapshot(
        ECallReconnectStatus.BACKOFF,
        createDefaultContext(ECallReconnectStatus.BACKOFF),
      ),
    );

    expect(instance.attempt).toBe(1);
    expect(instance.nextDelayMs).toBe(1000);
  });

  describe('runtime negative cases (unsafe cast)', () => {
    it('keeps reconnecting=true for ATTEMPTING with incomplete context', () => {
      const instance = createInstance(
        unsafeSnapshot({
          state: ECallReconnectStatus.ATTEMPTING,
          context: {},
        }),
      );

      expect(instance.isReconnecting()).toBe(true);
    });
  });
});
