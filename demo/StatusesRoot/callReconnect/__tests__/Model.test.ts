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

  it('maps initial snapshot', () => {
    const instance = createInstance();

    expect(instance.snapshot).toEqual({
      state: ECallReconnectStatus.IDLE,
      context: {},
    });
    expect(instance.isReconnecting).toBe(false);
  });

  it.each([
    ECallReconnectStatus.IDLE,
    ECallReconnectStatus.ARMED,
    ECallReconnectStatus.ERROR_TERMINAL,
  ])('%s -> isReconnecting=false', (state) => {
    const instance = createInstance(createSnapshot(state, createDefaultContext(state)));

    expect(instance.isReconnecting).toBe(false);
  });

  it.each([
    ECallReconnectStatus.EVALUATING,
    ECallReconnectStatus.BACKOFF,
    ECallReconnectStatus.WAITING_SIGNALING,
    ECallReconnectStatus.ATTEMPTING,
    ECallReconnectStatus.LIMIT_REACHED,
  ])('%s -> isReconnecting=true', (state) => {
    const instance = createInstance(createSnapshot(state, createDefaultContext(state)));

    expect(instance.isReconnecting).toBe(true);
  });

  describe('runtime negative cases (unsafe cast)', () => {
    it('keeps reconnecting=true for ATTEMPTING with incomplete context', () => {
      const instance = createInstance(
        unsafeSnapshot({
          state: ECallReconnectStatus.ATTEMPTING,
          context: {},
        }),
      );

      expect(instance.isReconnecting).toBe(true);
    });
  });
});
