import type { TIceServer } from '../types';

const hasValidUrls = (urls?: unknown): boolean => {
  if (urls === undefined) {
    return false;
  }

  const serverUrls = Array.isArray(urls) ? urls : [urls];

  return serverUrls.every((url: string) => {
    try {
      /* eslint-disable no-new */
      new URL(url);

      return true;
    } catch {
      /* eslint-disable no-console */
      console.error(`Invalid URL: ${url}`);

      return false;
    }
  });
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isValidIceServer = (server: unknown): boolean => {
  return isObject(server) && hasValidUrls(server.urls);
};

const isValidIceServers = (servers: unknown): boolean => {
  return (
    Array.isArray(servers) &&
    servers.every((server: unknown) => {
      return isValidIceServer(server);
    })
  );
};

const getDefaultIceServer = (ip: string) => {
  return [
    {
      urls: [`stun:${ip}:3478`],
    },
  ];
};

const shouldUseIceServersFromServerConfig = (
  iceServersFromServerConfig?: unknown,
): iceServersFromServerConfig is TIceServer[] => {
  return iceServersFromServerConfig !== undefined && isValidIceServers(iceServersFromServerConfig);
};

const parseIceServersFromServerConfig = (
  ip: string,
  iceServersFromServerConfig?: unknown,
): TIceServer[] => {
  if (shouldUseIceServersFromServerConfig(iceServersFromServerConfig)) {
    return iceServersFromServerConfig;
  }

  return getDefaultIceServer(ip);
};

export default parseIceServersFromServerConfig;
