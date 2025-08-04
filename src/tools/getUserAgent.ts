import replaceForbiddenSymbolsWithUnderscore from '../utils/replaceForbiddenSymbolsWithUnderscore';

const getUserAgentUnifiedSdpSemantic = ({
  appName,
  appVersion,
  browserName,
  browserVersion,
}: {
  appName: string;
  appVersion: number;
  browserName?: string;
  browserVersion?: string;
}): string => {
  const fixedAppName = replaceForbiddenSymbolsWithUnderscore(appName);

  const appInfo = `${fixedAppName} ${appVersion}`;
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  const suffix = browserName ? `${browserName} ${browserVersion}, ${appInfo}` : appInfo;

  const userAgent = `ChromeNew - ${suffix}`;

  return userAgent;
};

const getUserAgent = ({
  isUnifiedSdpSemantic,
  appVersion,
  browserName,
  browserVersion,
  appName,
}: {
  isUnifiedSdpSemantic: boolean;
  appName: string;
  appVersion: number;
  browserName?: string;
  browserVersion?: string;
}): string => {
  const userAgent = isUnifiedSdpSemantic
    ? getUserAgentUnifiedSdpSemantic({ appVersion, browserName, browserVersion, appName })
    : 'Chrome';

  return userAgent;
};

export default getUserAgent;
