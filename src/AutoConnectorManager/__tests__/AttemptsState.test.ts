import AttemptsState from '../AttemptsState';

describe('AttemptsState', () => {
  let attemptsState: AttemptsState;

  const onStatusChange = jest.fn();

  beforeEach(() => {
    attemptsState = new AttemptsState({ onStatusChange });
  });

  it('начальные значения', () => {
    expect(attemptsState.count).toBe(0);
    expect(attemptsState.limit).toBe(30);
    expect(attemptsState.isAttemptInProgress).toBe(false);
  });

  it('increment: увеличивает count', () => {
    attemptsState.increment();

    expect(attemptsState.count).toBe(1);
  });

  it('increment: не увеличивает count, если count >= limit', () => {
    for (let i = 0; i < attemptsState.limit; i += 1) {
      attemptsState.increment();
    }

    expect(attemptsState.count).toBe(attemptsState.limit);

    attemptsState.increment();

    expect(attemptsState.count).toBe(attemptsState.limit);
  });

  it('startAttempt: устанавливает isAttemptInProgress в true', () => {
    attemptsState.startAttempt();

    expect(attemptsState.isAttemptInProgress).toBe(true);
  });

  it('finishAttempt: устанавливает isAttemptInProgress в false', () => {
    attemptsState.finishAttempt();

    expect(attemptsState.isAttemptInProgress).toBe(false);
  });

  it('reset: сбрасывает count и isAttemptInProgress', () => {
    attemptsState.increment();
    attemptsState.startAttempt();

    expect(attemptsState.isAttemptInProgress).toBe(true);

    attemptsState.reset();

    expect(attemptsState.count).toBe(0);
    expect(attemptsState.isAttemptInProgress).toBe(false);
  });

  it('hasLimitReached: проверяет достижение лимита', () => {
    expect(attemptsState.hasLimitReached()).toBe(false);

    for (let i = 0; i < attemptsState.limit; i += 1) {
      attemptsState.increment();
    }

    expect(attemptsState.hasLimitReached()).toBe(true);

    attemptsState.reset();

    expect(attemptsState.hasLimitReached()).toBe(false);
  });

  it('onStatusChange: вызывается при изменении isAttemptInProgress', () => {
    attemptsState.startAttempt();

    expect(onStatusChange).toHaveBeenCalledTimes(1);

    attemptsState.startAttempt();

    expect(onStatusChange).toHaveBeenCalledTimes(1);

    attemptsState.finishAttempt();

    expect(onStatusChange).toHaveBeenCalledTimes(2);

    attemptsState.finishAttempt();

    expect(onStatusChange).toHaveBeenCalledTimes(2);
  });
});
