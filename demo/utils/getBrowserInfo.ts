/**
 * Получает информацию о браузере из userAgent
 */
const getBrowserInfo = (): { name: string; version: string } => {
  const { userAgent } = navigator;
  let browserName = 'Unknown';
  let browserVersion = '0';

  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    browserName = 'Chrome';

    const match = /Chrome\/(\d+)/.exec(userAgent) ?? [];

    browserVersion = match[1] || '0';
  } else if (userAgent.includes('Firefox')) {
    browserName = 'Firefox';

    const match = /Firefox\/(\d+)/.exec(userAgent) ?? [];

    browserVersion = match[1] || '0';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browserName = 'Safari';

    const match = /Version\/(\d+)/.exec(userAgent) ?? [];

    browserVersion = match[1] || '0';
  } else if (userAgent.includes('Edg')) {
    browserName = 'Edge';

    const match = /Edg\/(\d+)/.exec(userAgent) ?? [];

    browserVersion = match[1] || '0';
  }

  return { name: browserName, version: browserVersion };
};

export default getBrowserInfo;
