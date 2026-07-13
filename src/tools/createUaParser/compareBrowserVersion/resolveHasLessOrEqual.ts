import hasLessOrEqual from './hasLessOrEqual';

import type { TBrowserVersion } from './types';

const normalizeVersion = (version: TBrowserVersion): Required<TBrowserVersion> | undefined => {
  if (version.major === undefined) {
    return undefined;
  }

  return {
    major: version.major,
    minor: version.minor ?? 0,
    patch: version.patch ?? 0,
  };
};

/**
 * Создаёт функцию проверки «текущая версия меньше или равна заданной».
 * Недостающие minor/patch текущей версии считаются 0.
 * При отсутствии major у текущей версии возвращает false.
 *
 * @param currentVersion — текущая версия браузера.
 * @returns Предикат (compareVersion) => true, если текущая версия <= compareVersion.
 */
const resolveHasLessOrEqual = (currentVersion: TBrowserVersion) => {
  const normalizedCurrent = normalizeVersion(currentVersion);

  return (compareVersion: Required<TBrowserVersion>) => {
    if (normalizedCurrent === undefined) {
      return false;
    }

    return hasLessOrEqual(normalizedCurrent, compareVersion);
  };
};

export default resolveHasLessOrEqual;
