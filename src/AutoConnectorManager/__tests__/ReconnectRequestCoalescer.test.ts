import ReconnectRequestCoalescer from '../ReconnectRequestCoalescer';

describe('ReconnectRequestCoalescer', () => {
  const now = 1_000_000;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('увеличивает generation при первом запросе', () => {
    const coalescer = new ReconnectRequestCoalescer({ coalesceWindowMs: 250 });

    expect(coalescer.register('start')).toEqual({
      shouldRequest: true,
      generation: 1,
      currentPriority: 0,
    });
  });

  it('схлопывает одинаковую причину в пределах окна', () => {
    const coalescer = new ReconnectRequestCoalescer({ coalesceWindowMs: 250 });

    coalescer.register('telephony-check-failed');

    expect(coalescer.register('telephony-check-failed')).toEqual({
      shouldRequest: false,
      generation: 1,
      coalescedBy: 'telephony-check-failed',
      currentPriority: 1,
      coalescedByPriority: 1,
    });
  });

  it('пропускает более приоритетную причину в пределах окна', () => {
    const coalescer = new ReconnectRequestCoalescer({ coalesceWindowMs: 250 });

    coalescer.register('telephony-disconnected');

    expect(coalescer.register('registration-failed-out-of-call')).toEqual({
      shouldRequest: true,
      generation: 2,
      currentPriority: 3,
    });
  });

  it('после reset начинает новую серию без схлопывания', () => {
    const coalescer = new ReconnectRequestCoalescer({ coalesceWindowMs: 250 });

    coalescer.register('telephony-check-failed');
    coalescer.reset();

    expect(coalescer.register('registration-failed-out-of-call')).toEqual({
      shouldRequest: true,
      generation: 2,
      currentPriority: 3,
    });
  });
});
