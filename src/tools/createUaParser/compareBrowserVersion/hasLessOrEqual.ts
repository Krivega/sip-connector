import type { TBrowserVersion } from './types';

/**
 * Проверяет, что currentVersion <= compareVersion.
 */
const hasLessOrEqual = (
  currentVersion: Required<TBrowserVersion>,
  compareVersion: Required<TBrowserVersion>,
): boolean => {
  if (currentVersion.major !== compareVersion.major) {
    return currentVersion.major < compareVersion.major;
  }

  if (currentVersion.minor !== compareVersion.minor) {
    return currentVersion.minor < compareVersion.minor;
  }

  return currentVersion.patch <= compareVersion.patch;
};

export default hasLessOrEqual;
