import { UAParser } from 'ua-parser-js';

import {
  resolveHasGreaterThanBrowserVersion,
  resolveHasLessOrEqualBrowserVersion,
} from './compareBrowserVersion';
import getVersionParsed from './getVersionParsed';
import isElectronEnvironment from './isElectronEnvironment';

const createUaParser = () => {
  const uaParser = new UAParser();
  const { name: browserName, version: browserVersion } = uaParser.getBrowser();
  const { name: osName } = uaParser.getOS();
  const { type } = uaParser.getDevice();
  const isElectron = isElectronEnvironment();
  const isMobileDevice = type === 'mobile';

  const browserVersionParsed = getVersionParsed(browserVersion);
  const hasGreaterThanBrowserVersion = resolveHasGreaterThanBrowserVersion(browserVersionParsed);
  const hasLessOrEqualBrowserVersion = resolveHasLessOrEqualBrowserVersion(browserVersionParsed);

  return {
    hasGreaterThanBrowserVersion,
    hasLessOrEqualBrowserVersion,
    isMobileDevice,
    isChrome: browserName === 'Chrome' || isElectron,
    isFirefox: browserName === 'Firefox',
    isYandexBrowser: browserName === 'Yandex',
    isSafari: browserName === 'Safari',
    isOpera: browserName === 'Opera',
    isWindows: osName === 'Windows',
  };
};

export default createUaParser;
