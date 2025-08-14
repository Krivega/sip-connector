import isElectronEnvironment from '../isElectronEnvironment';

describe('isElectronEnvironment', () => {
  const originalProcess = globalThis.process;

  type TElectronLikeProcess = { versions?: { electron?: string } };

  const mutableGlobal = () => {
    return globalThis as unknown as {
      process?: TElectronLikeProcess | NodeJS.Process;
    };
  };

  afterEach(() => {
    // Восстанавливаем исходное значение, чтобы не влиять на другие тесты
    mutableGlobal().process = originalProcess;
  });

  test('возвращает false, когда globalThis.process отсутствует', () => {
    mutableGlobal().process = undefined;

    expect(isElectronEnvironment()).toBe(false);
  });

  test('возвращает false, когда electron не определён в process.versions', () => {
    mutableGlobal().process = { versions: {} };

    expect(isElectronEnvironment()).toBe(false);
  });

  test('возвращает true, когда electron определён в process.versions', () => {
    mutableGlobal().process = { versions: { electron: '28.0.0' } };

    expect(isElectronEnvironment()).toBe(true);
  });
});
