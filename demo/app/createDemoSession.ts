import { Session } from '../Session';
import getAppInfo from '../utils/getAppInfo';
import getBrowserInfo from '../utils/getBrowserInfo';

export const createDemoSession = (): Session => {
  const browserInfo = getBrowserInfo();
  const appInfo = getAppInfo();

  return new Session({
    serverParametersRequesterParams: {
      appVersion: appInfo.appVersion,
      appName: appInfo.appName,
      browserName: browserInfo.name,
      browserVersion: browserInfo.version,
    },
  });
};
