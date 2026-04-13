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

    coalescer.register('network-change');

    expect(coalescer.register('network-change')).toEqual({
      shouldRequest: false,
      generation: 1,
      coalescedBy: 'network-change',
      currentPriority: 4,
      coalescedByPriority: 4,
    });
  });

  it('пропускает более приоритетную причину в пределах окна', () => {
    const coalescer = new ReconnectRequestCoalescer({ coalesceWindowMs: 250 });

    coalescer.register('sleep-resume');

    expect(coalescer.register('network-change')).toEqual({
      shouldRequest: true,
      generation: 2,
      currentPriority: 4,
    });
  });

  it('после reset начинает новую серию без схлопывания', () => {
    const coalescer = new ReconnectRequestCoalescer({ coalesceWindowMs: 250 });

    coalescer.register('network-change');
    coalescer.reset();

    expect(coalescer.register('sleep-resume')).toEqual({
      shouldRequest: true,
      generation: 2,
      currentPriority: 2,
    });
  });
});
