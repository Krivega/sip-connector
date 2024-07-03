import fixForbiddenSymbols from '../fixForbiddenSymbols';

describe('fixForbiddenSymbols', () => {
  it('should replace all forbidden characters with the allowed character', () => {
    expect(fixForbiddenSymbols('@*!|')).toBe('____');
  });

  it('should not replace any allowed characters', () => {
    expect(fixForbiddenSymbols('abc')).toBe('abc');
  });

  it('should handle empty input', () => {
    expect(fixForbiddenSymbols('')).toBe('');
  });

  it('should handle input with multiple occurrences of forbidden characters', () => {
    expect(fixForbiddenSymbols('@*!|abc@*!|')).toBe('____abc____');
  });

  it('should handle input with mixed forbidden and allowed characters', () => {
    expect(fixForbiddenSymbols('@*!|abc@*!|def')).toBe('____abc____def');
  });
});
