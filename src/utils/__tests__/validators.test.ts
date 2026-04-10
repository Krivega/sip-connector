import { hasValidExtraHeaders, isValidBoolean, isValidObject, isValidString } from '../validators';

describe('isValidString', () => {
  it('должен возвращать true если передана непустая строка', () => {
    expect(isValidString('hello')).toBe(true);
  });

  it('не должен возвращать true если передано undefined', () => {
    expect(isValidString(undefined)).toBe(false);
  });

  it('не должен возвращать true если передана пустая строка', () => {
    expect(isValidString('')).toBe(false);
  });

  it('не должен возвращать true если передана строка только из пробелов', () => {
    expect(isValidString('   ')).toBe(false);
  });

  it('не должен возвращать true если передано число', () => {
    expect(isValidString(123)).toBe(false);
  });

  it('не должен возвращать true если передано булево значение', () => {
    expect(isValidString(true)).toBe(false);
  });

  it('не должен возвращать true если передан объект', () => {
    expect(isValidString({})).toBe(false);
  });

  it('не должен возвращать true если передан массив', () => {
    expect(isValidString([])).toBe(false);
  });
});

describe('isValidObject', () => {
  it('должен возвращать true если передан объект', () => {
    expect(isValidObject({})).toBe(true);
  });

  it('не должен возвращать true если передано undefined', () => {
    expect(isValidObject(undefined)).toBe(false);
  });

  it('не должен возвращать true если передан массив', () => {
    expect(isValidObject([])).toBe(false);
  });

  it('не должен возвращать true если передано число', () => {
    expect(isValidObject(123)).toBe(false);
  });

  it('не должен возвращать true если передано булево значение', () => {
    expect(isValidObject(true)).toBe(false);
  });

  it('не должен возвращать true если передана строка', () => {
    expect(isValidObject('hello')).toBe(false);
  });
});

describe('isValidBoolean', () => {
  it('должен возвращать true если передано значение true', () => {
    expect(isValidBoolean(true)).toBe(true);
  });

  it('должен возвращать true если передано значение false', () => {
    expect(isValidBoolean(false)).toBe(true);
  });

  it('не должен возвращать true если передано значение другого типа', () => {
    expect(isValidBoolean(undefined)).toBe(false);
    expect(isValidBoolean(123)).toBe(false);
    expect(isValidBoolean('hello')).toBe(false);
    expect(isValidBoolean({})).toBe(false);
    expect(isValidBoolean([])).toBe(false);
  });
});

describe('hasValidExtraHeaders', () => {
  it('должен возвращать true если передан массив строк', () => {
    expect(hasValidExtraHeaders(['X-Test: 1', 'X-Vinteo-Presentation-Call: yes'])).toBe(true);
  });

  it('должен возвращать true если передан пустой массив', () => {
    expect(hasValidExtraHeaders([])).toBe(true);
  });

  it('не должен возвращать true если передано undefined', () => {
    expect(hasValidExtraHeaders(undefined)).toBe(false);
  });

  it('не должен возвращать true если передано значение не типа массив', () => {
    expect(hasValidExtraHeaders('X-Test: 1')).toBe(false);
  });

  it('не должен возвращать true если в массиве есть элементы не строкового типа', () => {
    expect(hasValidExtraHeaders(['X-Test: 1', 1, true])).toBe(false);
  });
});
