import hasIncludesString from '../hasIncludesString';

describe('hasIncludesString', () => {
  it('both undefined', () => {
    expect(hasIncludesString()).toBe(false);
  });

  it('target undefined', () => {
    expect(hasIncludesString('source')).toBe(false);
  });

  it('source undefined', () => {
    expect(hasIncludesString(undefined, 'target')).toBe(false);
  });

  it('equal', () => {
    expect(hasIncludesString('target', 'target')).toBe(true);
  });

  it('not equal', () => {
    expect(hasIncludesString('source', 'target')).toBe(false);
  });

  it('register', () => {
    expect(hasIncludesString('video/av1', 'AV1')).toBe(true);
  });
});
