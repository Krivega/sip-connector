import replaceForbiddenSymbolsWithUnderscore from '../replaceForbiddenSymbolsWithUnderscore';

describe('replaceForbiddenSymbolsWithUnderscore', () => {
  it('should replace all forbidden characters with the allowed character', () => {
    expect(replaceForbiddenSymbolsWithUnderscore('@*!|')).toBe('____');
  });

  it('should not replace any allowed characters', () => {
    expect(replaceForbiddenSymbolsWithUnderscore('abc')).toBe('abc');
  });

  it('should handle empty input', () => {
    expect(replaceForbiddenSymbolsWithUnderscore('')).toBe('');
  });

  it('should handle input with multiple occurrences of forbidden characters', () => {
    expect(replaceForbiddenSymbolsWithUnderscore('@*!|abc@*!|')).toBe('____abc____');
  });

  it('should handle input with mixed forbidden and allowed characters', () => {
    expect(replaceForbiddenSymbolsWithUnderscore('@*!|abc@*!|def')).toBe('____abc____def');
  });
});
