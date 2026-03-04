import type { TBrowserVersion } from './types';

const hasValidVersion = (version: TBrowserVersion): version is Required<TBrowserVersion> => {
  return version.major !== undefined && version.minor !== undefined && version.patch !== undefined;
};

export default hasValidVersion;
