/// <reference types="jest" />
import resolveHasLessOrEqual from '../resolveHasLessOrEqual';

describe('resolveHasLessOrEqual', () => {
  it('возвращает true для идентичных версий', () => {
    const hasLessOrEqual = resolveHasLessOrEqual({ major: 109, minor: 0, patch: 0 });

    expect(hasLessOrEqual({ major: 109, minor: 0, patch: 0 })).toBe(true);
  });

  it('возвращает false когда текущая версия без major', () => {
    const hasLessOrEqual = resolveHasLessOrEqual({});

    expect(hasLessOrEqual({ major: 109, minor: 0, patch: 0 })).toBe(false);
  });

  it('нормализует отсутствующие minor/patch в 0', () => {
    const hasLessOrEqualWithoutPatch = resolveHasLessOrEqual({ major: 100, minor: 0 });
    const hasLessOrEqualWithoutMinor = resolveHasLessOrEqual({ major: 100 });

    expect(hasLessOrEqualWithoutPatch({ major: 109, minor: 0, patch: 0 })).toBe(true);
    expect(hasLessOrEqualWithoutMinor({ major: 109, minor: 0, patch: 0 })).toBe(true);
  });

  describe('когда текущая версия меньше или равна', () => {
    it('возвращает true когда текущая major меньше', () => {
      const hasLessOrEqual = resolveHasLessOrEqual({ major: 100, minor: 0, patch: 0 });

      expect(hasLessOrEqual({ major: 109, minor: 0, patch: 0 })).toBe(true);
    });

    it('возвращает true когда текущая minor меньше', () => {
      const hasLessOrEqual = resolveHasLessOrEqual({ major: 109, minor: 0, patch: 0 });

      expect(hasLessOrEqual({ major: 109, minor: 1, patch: 0 })).toBe(true);
    });

    it('возвращает true когда текущая patch меньше', () => {
      const hasLessOrEqual = resolveHasLessOrEqual({ major: 109, minor: 0, patch: 0 });

      expect(hasLessOrEqual({ major: 109, minor: 0, patch: 1 })).toBe(true);
    });
  });

  describe('когда текущая версия больше', () => {
    it('возвращает false когда текущая major больше', () => {
      const hasLessOrEqual = resolveHasLessOrEqual({ major: 120, minor: 0, patch: 0 });

      expect(hasLessOrEqual({ major: 109, minor: 0, patch: 0 })).toBe(false);
    });

    it('возвращает false когда текущая minor больше', () => {
      const hasLessOrEqual = resolveHasLessOrEqual({ major: 109, minor: 2, patch: 0 });

      expect(hasLessOrEqual({ major: 109, minor: 1, patch: 0 })).toBe(false);
    });

    it('возвращает false когда текущая patch больше', () => {
      const hasLessOrEqual = resolveHasLessOrEqual({ major: 109, minor: 0, patch: 2 });

      expect(hasLessOrEqual({ major: 109, minor: 0, patch: 1 })).toBe(false);
    });
  });
});
