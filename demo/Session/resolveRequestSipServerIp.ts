import { CancelableRequest } from '@krivega/cancelable-promise';

import parseIceServersFromServerConfig from './parseIceServersFromServerConfig';

import type { TIceServer } from '../types';

type TServerResponse = {
  ip: string;
  remoteAddress: string;
  iceServers?: TIceServer[];
  unified?: boolean;
};

type TResponse = TServerResponse & {
  ip: string;
  remoteAddress: string;
  unified: boolean;
  iceServers: TIceServer[];
};

const requestServerIp = async (serverUrl: string): Promise<TResponse> => {
  const apiUrl = `https://${serverUrl.trim()}/api/v1/address`;
  const response = await fetch(apiUrl);
  const {
    ip,
    remoteAddress,
    unified,
    iceServers: iceServersFromServerConfig,
  } = (await response.json()) as TServerResponse;

  const iceServers = parseIceServersFromServerConfig(ip, iceServersFromServerConfig);

  return { ip, remoteAddress, unified: Boolean(unified), iceServers };
};

interface SipServerRequester {
  request: (_sipServerUrl: string) => Promise<TResponse>;
  cancelRequest: () => void;
}

const resolveRequestSipServerIp = (): SipServerRequester => {
  const serverIpCancelableRequester = new CancelableRequest(requestServerIp);

  const request = async (sipServerUrl: string): Promise<TResponse> => {
    return serverIpCancelableRequester.request(sipServerUrl);
  };

  const cancelRequest = (): void => {
    serverIpCancelableRequester.cancelRequest();
  };

  return { request, cancelRequest };
};

export default resolveRequestSipServerIp;
