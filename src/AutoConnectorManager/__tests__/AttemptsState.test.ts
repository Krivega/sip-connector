import { TypedEvents } from 'events-constructor';

import AttemptsState from '../AttemptsState';

import type { TEventMap } from '../eventNames';

describe('AttemptsState', () => {
  let attemptsState: AttemptsState;

  const events = new TypedEvents<TEventMap>(['changed-attempt-status']);

  beforeEach(() => {
    attemptsState = new AttemptsState({ events });
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
    // @ts-ignore приватное свойство
    attemptsState.limitInner = 1;

    attemptsState.increment();

    expect(attemptsState.count).toBe(1);

    attemptsState.increment();

    expect(attemptsState.count).toBe(1);
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
    // @ts-ignore приватное свойство
    attemptsState.limitInner = 1;

    expect(attemptsState.hasLimitReached()).toBe(false);

    attemptsState.increment();

    expect(attemptsState.hasLimitReached()).toBe(true);

    attemptsState.reset();

    expect(attemptsState.hasLimitReached()).toBe(false);
  });

  it('onStatusChange: вызывается при изменении isAttemptInProgress', () => {
    const handleStatusChange = jest.fn();

    events.on('changed-attempt-status', handleStatusChange);

    attemptsState.startAttempt();

    expect(handleStatusChange).toHaveBeenCalledTimes(1);

    attemptsState.startAttempt();

    expect(handleStatusChange).toHaveBeenCalledTimes(1);

    attemptsState.finishAttempt();

    expect(handleStatusChange).toHaveBeenCalledTimes(2);

    attemptsState.finishAttempt();

    expect(handleStatusChange).toHaveBeenCalledTimes(2);
  });
});
