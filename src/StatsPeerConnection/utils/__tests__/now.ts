import now from '../now';

describe('now', () => {
  let originalPerformanceDescriptor: PropertyDescriptor | undefined;
  let originalDateNow: () => number;

  beforeEach(() => {
    originalPerformanceDescriptor = Object.getOwnPropertyDescriptor(window, 'performance');
    originalDateNow = Date.now;
  });

  afterEach(() => {
    // restore globals after each test
    if (originalPerformanceDescriptor) {
      Object.defineProperty(window, 'performance', originalPerformanceDescriptor);
    } else {
      // ensure no stray property is left behind
      try {
        // @ts-ignore - property may not exist in this environment
        delete (window as unknown as { performance?: Performance }).performance;
      } catch {
        // ignore
      }
    }

    Date.now = originalDateNow;
    jest.restoreAllMocks();
  });

  it('#1 uses performance.now when available', () => {
    const perfNow = jest.fn().mockReturnValue(123.456);

    // Make property configurable for reliable cleanup
    Object.defineProperty(window, 'performance', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: { now: perfNow } as unknown as Performance,
    });

    jest.spyOn(Date, 'now');

    expect(now()).toBe(123.456);
    expect(perfNow).toHaveBeenCalledTimes(1);
  });

  it('#2 falls back to Date.now when performance is not present', () => {
    // Ensure we can delete the property by redefining it as configurable
    try {
      Object.defineProperty(window, 'performance', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: originalPerformanceDescriptor?.value,
      });
      // @ts-ignore - delete to make `'performance' in window` false
      delete (window as unknown as { performance?: Performance }).performance;
    } catch {
      // If deleting fails in this environment, skip forcing delete
      // and rely on default environment, but this would not hit fallback path
    }

    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(987_654_321);

    expect(now()).toBe(987_654_321);
    expect(dateNowSpy).toHaveBeenCalled();
  });
});
