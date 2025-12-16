import packageJson from '../../package.json';

/**
 * Получает информацию о приложении из package.json
 */
const getAppInfo = (): { appName: string; appVersion: number } => {
  const versionString = packageJson.version;
  const majorVersion = Number.parseInt(versionString.split('.')[0] ?? '0', 10);

  return {
    appName: packageJson.name,
    appVersion: majorVersion,
  };
};

export default getAppInfo;
