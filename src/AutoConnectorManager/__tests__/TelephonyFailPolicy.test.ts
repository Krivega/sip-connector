import TelephonyFailPolicy from '../TelephonyFailPolicy';

describe('TelephonyFailPolicy', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('делает reconnect на первом fail и накапливает backoff', () => {
    const policy = new TelephonyFailPolicy({
      baseRetryDelayMs: 1000,
      maxRetryDelayMs: 5000,
    });

    expect(policy.registerFailure()).toEqual({
      failCount: 1,
      escalationLevel: 'none',
      hasEscalated: false,
      shouldRequestReconnect: true,
      nextRetryDelayMs: 1000,
    });
  });

  it('в окне backoff не запрашивает reconnect повторно', () => {
    const policy = new TelephonyFailPolicy({
      baseRetryDelayMs: 1000,
      maxRetryDelayMs: 5000,
    });

    policy.registerFailure();
    (Date.now as jest.Mock).mockReturnValue(1500);

    expect(policy.registerFailure()).toEqual({
      failCount: 2,
      escalationLevel: 'none',
      hasEscalated: false,
      shouldRequestReconnect: false,
      nextRetryDelayMs: 500,
    });
  });

  it('эскалирует warning и critical по порогам', () => {
    const policy = new TelephonyFailPolicy({
      baseRetryDelayMs: 0,
      maxRetryDelayMs: 0,
      warningThreshold: 2,
      criticalThreshold: 3,
    });

    expect(policy.registerFailure().escalationLevel).toBe('none');
    expect(policy.registerFailure()).toEqual({
      failCount: 2,
      escalationLevel: 'warning',
      hasEscalated: true,
      shouldRequestReconnect: true,
      nextRetryDelayMs: 0,
    });
    expect(policy.registerFailure()).toEqual({
      failCount: 3,
      escalationLevel: 'critical',
      hasEscalated: true,
      shouldRequestReconnect: true,
      nextRetryDelayMs: 0,
    });
  });

  it('reset сбрасывает счетчик и эскалацию', () => {
    const policy = new TelephonyFailPolicy({
      baseRetryDelayMs: 0,
      maxRetryDelayMs: 0,
      warningThreshold: 2,
    });

    policy.registerFailure();
    policy.registerFailure();
    policy.reset();

    expect(policy.registerFailure()).toEqual({
      failCount: 1,
      escalationLevel: 'none',
      hasEscalated: false,
      shouldRequestReconnect: true,
      nextRetryDelayMs: 0,
    });
  });
});
