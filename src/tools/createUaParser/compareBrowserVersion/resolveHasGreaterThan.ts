import hasGreaterThan from './hasGreaterThan';
import hasValidVersion from './hasValidVersion';

import type { TBrowserVersion } from './types';

/**
 * Создаёт функцию проверки «текущая версия строго больше заданной».
 * Учитывает только валидные версии; при невалидной текущей версии возвращает false.
 *
 * @param currentVersion — текущая версия (major, minor, patch).
 * @returns Предикат (compareVersion) => true, если текущая версия строго больше compareVersion.
 */
const resolveHasGreaterThan = (currentVersion: TBrowserVersion) => {
  return (compareVersion: Required<TBrowserVersion>) => {
    return hasValidVersion(currentVersion) && hasGreaterThan(currentVersion, compareVersion);
  };
};

export default resolveHasGreaterThan;
