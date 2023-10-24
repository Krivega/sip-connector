const getExtraHeaders = ({
  sessionId,
  remoteAddress,
  isMutedAudio,
  isMutedVideo,
  isRegistered,
  isPresentationCall,
}: {
  sessionId?: string;
  remoteAddress?: string;
  isRegistered?: boolean;
  isMutedAudio: boolean;
  isMutedVideo: boolean;
  isPresentationCall?: boolean;
}): string[] => {
  const headers: string[] = [];

  const muteStateMic = isMutedAudio ? '0' : '1';
  const muteStateCam = isMutedVideo ? '0' : '1';

  headers.push(`X-Vinteo-Mic-State: ${muteStateMic}`, `X-Vinteo-MainCam-State: ${muteStateCam}`);

  if (!isRegistered) {
    headers.push('X-Vinteo-Purgatory-Call: yes');
  }

  if (sessionId) {
    headers.push(`X-Vinteo-Session: ${sessionId}`);
  }

  if (isPresentationCall) {
    headers.push('X-Vinteo-Presentation-Call: yes');
  }

  if (remoteAddress) {
    headers.push(`X-Vinteo-Remote: ${remoteAddress}`);
  }

  return headers;
};

export default getExtraHeaders;
