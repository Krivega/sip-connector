import AttemptsState from '../AttemptsState';

describe('CallReconnectManager / AttemptsState', () => {
  const createSubject = (limit: number) => {
    const onStatusChange = jest.fn();
    const state = new AttemptsState({ limit, onStatusChange });

    return { state, onStatusChange };
  };

  it('initial values', () => {
    const { state } = createSubject(3);

    expect(state.count).toBe(0);
    expect(state.limit).toBe(3);
    expect(state.isAttemptInProgress).toBe(false);
    expect(state.hasLimitReached()).toBe(false);
  });

  it('increment increases count and reaches limit', () => {
    const { state } = createSubject(2);

    state.increment();
    expect(state.count).toBe(1);
    expect(state.hasLimitReached()).toBe(false);

    state.increment();
    expect(state.count).toBe(2);
    expect(state.hasLimitReached()).toBe(true);
  });

  it('unlimited mode (limit=0) never reports reached', () => {
    const { state } = createSubject(0);

    for (let index = 0; index < 100; index += 1) {
      state.increment();
    }

    expect(state.hasLimitReached()).toBe(false);
  });

  it('startAttempt/finishAttempt: toggle isInProgress and notify only on transitions', () => {
    const { state, onStatusChange } = createSubject(5);

    state.startAttempt();
    state.startAttempt();
    expect(state.isAttemptInProgress).toBe(true);
    expect(onStatusChange).toHaveBeenCalledTimes(1);
    expect(onStatusChange).toHaveBeenLastCalledWith({ isInProgress: true });

    state.finishAttempt();
    state.finishAttempt();
    expect(state.isAttemptInProgress).toBe(false);
    expect(onStatusChange).toHaveBeenCalledTimes(2);
    expect(onStatusChange).toHaveBeenLastCalledWith({ isInProgress: false });
  });

  it('reset clears count and finishes in-progress attempt', () => {
    const { state, onStatusChange } = createSubject(3);

    state.increment();
    state.increment();
    state.startAttempt();

    state.reset();

    expect(state.count).toBe(0);
    expect(state.isAttemptInProgress).toBe(false);
    expect(onStatusChange).toHaveBeenLastCalledWith({ isInProgress: false });
  });
});
