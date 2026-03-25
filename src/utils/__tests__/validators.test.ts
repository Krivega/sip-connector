import { isValidBoolean, isValidObject, isValidString } from '../validators';

describe('isValidString', () => {
  it('should return true for a valid string', () => {
    expect(isValidString('hello')).toBe(true);
  });

  it('should return false for an invalid string', () => {
    expect(isValidString(undefined)).toBe(false);
  });

  it('should return false for an empty string', () => {
    expect(isValidString('')).toBe(false);
  });

  it('should return false for a string with only spaces', () => {
    expect(isValidString('   ')).toBe(false);
  });

  it('should return false for a number', () => {
    expect(isValidString(123)).toBe(false);
  });

  it('should return false for a boolean', () => {
    expect(isValidString(true)).toBe(false);
  });

  it('should return false for an object', () => {
    expect(isValidString({})).toBe(false);
  });

  it('should return false for an array', () => {
    expect(isValidString([])).toBe(false);
  });
});

describe('isValidObject', () => {
  it('should return true for a valid object', () => {
    expect(isValidObject({})).toBe(true);
  });

  it('should return false for an invalid object', () => {
    expect(isValidObject(undefined)).toBe(false);
  });

  it('should return false for an array', () => {
    expect(isValidObject([])).toBe(false);
  });

  it('should return false for a number', () => {
    expect(isValidObject(123)).toBe(false);
  });

  it('should return false for a boolean', () => {
    expect(isValidObject(true)).toBe(false);
  });

  it('should return false for a string', () => {
    expect(isValidObject('hello')).toBe(false);
  });
});

describe('isValidBoolean', () => {
  it('should return true for a valid boolean', () => {
    expect(isValidBoolean(true)).toBe(true);
  });

  it('should return true for a false boolean', () => {
    expect(isValidBoolean(false)).toBe(true);
  });

  it('should return false for an invalid boolean', () => {
    expect(isValidBoolean(undefined)).toBe(false);
    expect(isValidBoolean(123)).toBe(false);
    expect(isValidBoolean('hello')).toBe(false);
    expect(isValidBoolean({})).toBe(false);
    expect(isValidBoolean([])).toBe(false);
  });
});
