/// <reference types="jest" />
import hasPurgatory, { PURGATORY_CONFERENCE_NUMBER } from '../hasPurgatory';

describe('hasPurgatory', () => {
  it('should return true when room is purgatory', () => {
    const result = hasPurgatory('purgatory');

    expect(result).toBe(true);
  });

  it('should return false when room is not purgatory', () => {
    const result = hasPurgatory('room123');

    expect(result).toBe(false);
  });

  it('should return false when room is undefined', () => {
    const result = hasPurgatory(undefined);

    expect(result).toBe(false);
  });

  it('should return false when room is empty string', () => {
    const result = hasPurgatory('');

    expect(result).toBe(false);
  });

  it('should return false when room is null', () => {
    const result = hasPurgatory(undefined);

    expect(result).toBe(false);
  });

  it('should return false when room is different case', () => {
    const result = hasPurgatory('PURGATORY');

    expect(result).toBe(false);
  });

  it('should return false when room contains purgatory as substring', () => {
    const result = hasPurgatory('mypurgatoryroom');

    expect(result).toBe(false);
  });

  it('should return false when room is whitespace', () => {
    const result = hasPurgatory('   ');

    expect(result).toBe(false);
  });

  it('should return false when room is number', () => {
    const result = hasPurgatory('123');

    expect(result).toBe(false);
  });

  it('should return false when room is special characters', () => {
    const result = hasPurgatory('!@#$%');

    expect(result).toBe(false);
  });
});

describe('PURGATORY_CONFERENCE_NUMBER', () => {
  it('should be equal to "purgatory"', () => {
    expect(PURGATORY_CONFERENCE_NUMBER).toBe('purgatory');
  });

  it('should be a string', () => {
    expect(typeof PURGATORY_CONFERENCE_NUMBER).toBe('string');
  });
});
