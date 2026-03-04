/// <reference types="jest" />
import getVersionParsed from '../getVersionParsed';

describe('getVersionParsed', () => {
  it('корректно парсит строку версии', () => {
    const version = '1.2.3';
    const expected = { major: 1, minor: 2, patch: 3 };

    expect(getVersionParsed(version)).toEqual(expected);
  });

  it('обрабатывает строку версии с ведущими нулями', () => {
    const version = '01.02.03';
    const expected = { major: 1, minor: 2, patch: 3 };

    expect(getVersionParsed(version)).toEqual(expected);
  });

  it('обрабатывает строку версии без patch версии', () => {
    const version = '1.2';
    const expected = { major: 1, minor: 2, patch: undefined };

    expect(getVersionParsed(version)).toEqual(expected);
  });

  it('обрабатывает некорректную строку версии', () => {
    const version = 'invalid';

    const expected = { major: undefined, minor: undefined, patch: undefined };

    expect(getVersionParsed(version)).toEqual(expected);
  });

  it('обрабатывает пустую строку версии', () => {
    const version = '';
    const expected = { major: undefined, minor: undefined, patch: undefined };

    expect(getVersionParsed(version)).toEqual(expected);
  });

  it('обрабатывает undefined версию', () => {
    const expected = { major: undefined, minor: undefined, patch: undefined };

    expect(getVersionParsed(undefined)).toEqual(expected);
  });
});
