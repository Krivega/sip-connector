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

  if (isRegistered === false || isRegistered === undefined) {
    headers.push('X-Vinteo-Purgatory-Call: yes');
  }

  if (sessionId !== undefined && sessionId !== '') {
    headers.push(`X-Vinteo-Session: ${sessionId}`);
  }

  if (isPresentationCall === true) {
    headers.push('X-Vinteo-Presentation-Call: yes');
  }

  if (remoteAddress !== undefined && remoteAddress !== '') {
    headers.push(`X-Vinteo-Remote: ${remoteAddress}`);
  }

  return headers;
};

export default getExtraHeaders;
