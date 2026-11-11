import createJestMock from '../createJestMock';

describe('public fixture mock types', () => {
  it('keeps the current Jest registry and implementation controls', () => {
    const mock = createJestMock((value: number) => {
      return value + 1;
    });

    expect(mock(2)).toBe(3);
    expect(mock.mock.calls).toEqual([[2]]);
    jest.clearAllMocks();
    expect(mock.mock.calls).toEqual([]);
    mock.mockImplementation((value) => {
      return value * 2;
    });
    expect(mock(3)).toBe(6);
    mock.mockReset();
    expect(mock.mock.calls).toEqual([]);
  });

  it('preserves an unconfigured mock and its resolved-value controls', async () => {
    const mock = createJestMock();

    mock.mockResolvedValue('result');
    await expect(mock()).resolves.toBe('result');
    expect(mock.mockRestore).toEqual(expect.any(Function));
  });
});
