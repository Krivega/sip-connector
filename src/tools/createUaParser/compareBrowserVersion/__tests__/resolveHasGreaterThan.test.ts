/// <reference types="jest" />
import resolveHasGreaterThan from '../resolveHasGreaterThan';

describe('resolveHasGreaterThan', () => {
  it('возвращает false для идентичных версий', () => {
    const hasGreaterThan = resolveHasGreaterThan({ major: 1, minor: 9, patch: 9 });

    expect(hasGreaterThan({ major: 1, minor: 9, patch: 9 })).toBe(false);
  });

  it('возвращает false когда текущая версия невалидна', () => {
    const hasGreaterThan = resolveHasGreaterThan({});

    expect(hasGreaterThan({ major: 1, minor: 0, patch: 0 })).toBe(false);
  });

  describe('когда текущая версия больше', () => {
    it('возвращает false когда текущая major версия больше', () => {
      const hasGreaterThan = resolveHasGreaterThan({ major: 2, minor: 0, patch: 0 });

      expect(hasGreaterThan({ major: 1, minor: 9, patch: 9 })).toBe(false);
    });

    it('возвращает false когда текущая minor версия больше', () => {
      const hasGreaterThan = resolveHasGreaterThan({ major: 1, minor: 1, patch: 0 });

      expect(hasGreaterThan({ major: 1, minor: 0, patch: 9 })).toBe(false);
    });

    it('возвращает false когда текущая patch версия больше', () => {
      const hasGreaterThan = resolveHasGreaterThan({ major: 1, minor: 1, patch: 1 });

      expect(hasGreaterThan({ major: 1, minor: 1, patch: 0 })).toBe(false);
    });
  });

  describe('когда текущая версия меньше', () => {
    it('возвращает true когда текущая major версия меньше', () => {
      const hasGreaterThan = resolveHasGreaterThan({ major: 1, minor: 0, patch: 0 });

      expect(hasGreaterThan({ major: 2, minor: 0, patch: 0 })).toBe(true);
    });

    it('возвращает true когда текущая minor версия меньше', () => {
      const hasGreaterThan = resolveHasGreaterThan({ major: 1, minor: 0, patch: 0 });

      expect(hasGreaterThan({ major: 1, minor: 1, patch: 0 })).toBe(true);
    });

    it('возвращает true когда текущая patch версия меньше', () => {
      const hasGreaterThan = resolveHasGreaterThan({ major: 1, minor: 0, patch: 0 });

      expect(hasGreaterThan({ major: 1, minor: 0, patch: 1 })).toBe(true);
    });
  });
});
