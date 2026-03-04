import type { TBrowserVersion } from './types';

const hasGreaterThan = (
  currentVersion: Required<TBrowserVersion>,
  compareVersion: Required<TBrowserVersion>,
) => {
  const isEqualMajor = compareVersion.major === currentVersion.major;
  const isEqualMinor = compareVersion.minor === currentVersion.minor;

  const isGreaterThanMajor = compareVersion.major > currentVersion.major;
  const isGreaterThanMinor = isEqualMajor && compareVersion.minor > currentVersion.minor;
  const isGreaterThanPatch =
    isEqualMajor && isEqualMinor && compareVersion.patch > currentVersion.patch;

  return isGreaterThanMajor || isGreaterThanMinor || isGreaterThanPatch;
};

export default hasGreaterThan;
