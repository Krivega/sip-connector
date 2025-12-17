import resolveRequestSipServerIp from './resolveRequestSipServerIp';
import { tools } from '../../src/index';

import type { TIceServer } from '../types';

export interface IParams {
  appVersion: number;
  appName: string;
  browserName: string;
  browserVersion: string;
}

export interface IServerParameters {
  serverUrl: string;
  serverIp: string;
  iceServers: TIceServer[];
  extraHeaders: string[];
  sipServerUrl: string;
  userAgent: string;
  remoteAddress: string;
}

export interface IServerParametersRequester {
  request: ({
    serverUrl,
    isRegistered,
  }: {
    serverUrl: string;
    isRegistered: boolean;
  }) => Promise<IServerParameters>;
  cancelRequest: () => void;
}

const resolveServerParametersRequester = ({
  appVersion,
  appName,
  browserName,
  browserVersion,
}: IParams) => {
  const serverIpRequester = resolveRequestSipServerIp();

  const request = async ({
    serverUrl,
    isRegistered,
  }: {
    serverUrl: string;
    isRegistered: boolean;
  }): Promise<IServerParameters> => {
    return serverIpRequester
      .request(serverUrl)
      .then(({ remoteAddress, unified, iceServers, ip }) => {
        const extraHeaders = tools.getExtraHeaders({
          remoteAddress,
          isRegistered,
          isMutedAudio: false,
          isMutedVideo: false,
          isPresentationCall: false,
        });

        return {
          serverUrl,
          iceServers,
          extraHeaders,
          remoteAddress,
          serverIp: ip,
          sipServerUrl: `wss://${serverUrl}/webrtc/wss/`,
          userAgent: tools.getUserAgent({
            isUnifiedSdpSemantic: unified,
            browserName,
            browserVersion,
            appName,
            appVersion,
          }),
        };
      });
  };

  return {
    request,
    cancelRequest: serverIpRequester.cancelRequest,
  };
};

export default resolveServerParametersRequester;
