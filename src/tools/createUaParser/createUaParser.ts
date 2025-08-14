import { UAParser } from 'ua-parser-js';

import isElectronEnvironment from './isElectronEnvironment';

const createUaParser = () => {
  const uaParser = new UAParser();
  const { name: browserName } = uaParser.getBrowser();
  const isElectron = isElectronEnvironment();

  return {
    isChrome: browserName === 'Chrome' || isElectron,
  };
};

export default createUaParser;
