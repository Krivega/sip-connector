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
  const appInfo = `${appName} ${appVersion}`;
  let suffix: string;

  if (browserName) {
    suffix = `${browserName} ${browserVersion}, ${appInfo}`;
  } else {
    suffix = appInfo;
  }

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
