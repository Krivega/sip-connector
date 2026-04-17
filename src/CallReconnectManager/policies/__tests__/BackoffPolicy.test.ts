import { computeBackoffDelay } from '../BackoffPolicy';

describe('BackoffPolicy.computeBackoffDelay', () => {
  const baseParams = {
    baseBackoffMs: 1000,
    maxBackoffMs: 30_000,
    backoffFactor: 2,
  } as const;

  describe('deterministic path (jitter=none)', () => {
    it('returns base delay on first attempt', () => {
      expect(
        computeBackoffDelay(1, { ...baseParams, jitter: 'none' }, () => {
          return 0.5;
        }),
      ).toBe(1000);
    });

    it('applies exponential backoff factor', () => {
      expect(
        computeBackoffDelay(3, { ...baseParams, jitter: 'none' }, () => {
          return 0.5;
        }),
      ).toBe(4000);
    });

    it('clamps to maxBackoffMs', () => {
      expect(
        computeBackoffDelay(10, { ...baseParams, jitter: 'none' }, () => {
          return 0.5;
        }),
      ).toBe(30_000);
    });

    it('normalizes non-positive attempt to 1', () => {
      expect(
        computeBackoffDelay(0, { ...baseParams, jitter: 'none' }, () => {
          return 0.5;
        }),
      ).toBe(1000);
      expect(
        computeBackoffDelay(-5, { ...baseParams, jitter: 'none' }, () => {
          return 0.5;
        }),
      ).toBe(1000);
    });
  });

  describe('full jitter', () => {
    it('multiplies deterministic delay by random value (0..1)', () => {
      expect(
        computeBackoffDelay(2, { ...baseParams, jitter: 'full' }, () => {
          return 0;
        }),
      ).toBe(0);
      expect(
        computeBackoffDelay(2, { ...baseParams, jitter: 'full' }, () => {
          return 1;
        }),
      ).toBe(2000);
    });
  });

  describe('equal jitter', () => {
    it('returns half deterministic + random*(half)', () => {
      expect(
        computeBackoffDelay(2, { ...baseParams, jitter: 'equal' }, () => {
          return 0;
        }),
      ).toBe(1000);
      expect(
        computeBackoffDelay(2, { ...baseParams, jitter: 'equal' }, () => {
          return 1;
        }),
      ).toBe(2000);
    });
  });

  it('uses Math.random by default', () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

    computeBackoffDelay(1, { ...baseParams, jitter: 'full' });

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
