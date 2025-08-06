import getUserAgent from '../getUserAgent';

describe('getUserAgent', () => {
  it('should return "Chrome" when isUnifiedSdpSemantic=false', () => {
    const result = getUserAgent({
      isUnifiedSdpSemantic: false,
      appVersion: 17,
      appName: 'Vinteo Desktop',
    });

    expect(result).toBe('Chrome');
  });

  it('should return userAgent string when isUnifiedSdpSemantic=true', () => {
    const result = getUserAgent({
      isUnifiedSdpSemantic: true,
      appVersion: 17,
      appName: 'Vinteo Desktop',
      browserName: 'Chrome',
      browserVersion: '100',
    });

    expect(result).toBe('ChromeNew - Chrome 100, Vinteo Desktop 17');
  });

  it('should return the correct userAgent string when isUnifiedSdpSemantic=true and browserName is not provided', () => {
    const result = getUserAgent({
      isUnifiedSdpSemantic: true,
      appVersion: 17,
      appName: 'Vinteo Desktop',
      browserVersion: '100',
    });

    expect(result).toBe('ChromeNew - Vinteo Desktop 17');
  });

  it('should return the correct userAgent string when isUnifiedSdpSemantic=true and browserVersion is not provided', () => {
    const result = getUserAgent({
      isUnifiedSdpSemantic: true,
      appVersion: 17,
      appName: 'Vinteo Desktop',
      browserName: 'Chrome',
      browserVersion: undefined,
    });

    expect(result).toBe('ChromeNew - Chrome undefined, Vinteo Desktop 17');
  });

  it('should return the correct userAgent string when isUnifiedSdpSemantic=true and appName includes forbidden symbols', () => {
    const result = getUserAgent({
      isUnifiedSdpSemantic: true,
      appVersion: 17,
      appName: 'Vinteo Desktop | Preview @!*',
      browserName: 'Chrome',
      browserVersion: '100',
    });

    expect(result).toBe('ChromeNew - Chrome 100, Vinteo Desktop _ Preview ___ 17');
  });
});
