import getExtraHeaders from '../getExtraHeaders';

describe('getExtraHeaders', () => {
  it('#1 default', () => {
    const extraHeaders = getExtraHeaders({
      sessionId: undefined,
      remoteAddress: undefined,
      isMutedAudio: false,
      isMutedVideo: false,
      isRegistered: false,
      isPresentationCall: false,
    });

    expect(extraHeaders).toEqual([
      'X-Vinteo-Mic-State: 1',
      'X-Vinteo-MainCam-State: 1',
      'X-Vinteo-Purgatory-Call: yes',
    ]);
  });

  it('#2 should have all headers when all params has set', () => {
    const sessionId = 'sessionId';
    const remoteAddress = 'remoteAddress';

    const extraHeaders = getExtraHeaders({
      sessionId,
      remoteAddress,
      isMutedAudio: true,
      isMutedVideo: true,
      isRegistered: true,
      isPresentationCall: true,
    });

    expect(extraHeaders).toEqual([
      'X-Vinteo-Mic-State: 0',
      'X-Vinteo-MainCam-State: 0',
      'X-Vinteo-Session: sessionId',
      'X-Vinteo-Presentation-Call: yes',
      'X-Vinteo-Remote: remoteAddress',
    ]);
  });
});
