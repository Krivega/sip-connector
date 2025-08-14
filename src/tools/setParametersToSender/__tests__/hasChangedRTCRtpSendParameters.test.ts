/// <reference types="jest" />
import hasChangedRTCRtpSendParameters from '../hasChangedRTCRtpSendParameters';

describe('hasChangedRTCRtpSendParameters', () => {
  it('should return true when codecs length differs', () => {
    const parameters1: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [{ mimeType: 'audio/opus' }] as RTCRtpCodecParameters[],
      headerExtensions: [],
      encodings: [],
      rtcp: { cname: '', reducedSize: false },
    };

    const parameters2: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [],
      encodings: [],
      rtcp: { cname: '', reducedSize: false },
    };

    expect(hasChangedRTCRtpSendParameters(parameters1, parameters2)).toBe(true);
  });

  it('should return true when codecs differ', () => {
    const parameters1: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [{ mimeType: 'audio/opus' }] as RTCRtpCodecParameters[],
      headerExtensions: [],
      encodings: [],
      rtcp: { cname: '', reducedSize: false },
    };

    const parameters2: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [{ mimeType: 'video/vp8' }] as RTCRtpCodecParameters[],
      headerExtensions: [],
      encodings: [],
      rtcp: { cname: '', reducedSize: false },
    };

    expect(hasChangedRTCRtpSendParameters(parameters1, parameters2)).toBe(true);
  });

  it('should return true when codecs have same length but different content', () => {
    const parameters1: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [{ mimeType: 'audio/opus', clockRate: 48_000 }] as RTCRtpCodecParameters[],
      headerExtensions: [],
      encodings: [],
      rtcp: { cname: '', reducedSize: false },
    };

    const parameters2: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [{ mimeType: 'audio/opus', clockRate: 8000 }] as RTCRtpCodecParameters[],
      headerExtensions: [],
      encodings: [],
      rtcp: { cname: '', reducedSize: false },
    };

    expect(hasChangedRTCRtpSendParameters(parameters1, parameters2)).toBe(true);
  });

  it('should return true when headerExtensions length differs', () => {
    const parameters1: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [{ id: 1, uri: 'urn:ietf:params:rtp-hdrext:sdes:mid' }],
      encodings: [],
      rtcp: { cname: '', reducedSize: false },
    };

    const parameters2: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [],
      encodings: [],
      rtcp: { cname: '', reducedSize: false },
    };

    expect(hasChangedRTCRtpSendParameters(parameters1, parameters2)).toBe(true);
  });

  it('should return true when headerExtensions have same length but different content', () => {
    const parameters1: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [{ id: 1, uri: 'urn:ietf:params:rtp-hdrext:sdes:mid' }],
      encodings: [],
      rtcp: { cname: '', reducedSize: false },
    };

    const parameters2: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [{ id: 2, uri: 'urn:ietf:params:rtp-hdrext:sdes:mid' }],
      encodings: [],
      rtcp: { cname: '', reducedSize: false },
    };

    expect(hasChangedRTCRtpSendParameters(parameters1, parameters2)).toBe(true);
  });

  it('should return true when encodings length differs', () => {
    const parameters1: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [],
      encodings: [{}],
      rtcp: { cname: '', reducedSize: false },
    };

    const parameters2: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [],
      encodings: [],
      rtcp: { cname: '', reducedSize: false },
    };

    expect(hasChangedRTCRtpSendParameters(parameters1, parameters2)).toBe(true);
  });

  it('should return true when encodings have same length but different content', () => {
    const parameters1: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [],
      encodings: [{ maxBitrate: 1_000_000 }],
      rtcp: { cname: '', reducedSize: false },
    };

    const parameters2: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [],
      encodings: [{ maxBitrate: 2_000_000 }],
      rtcp: { cname: '', reducedSize: false },
    };

    expect(hasChangedRTCRtpSendParameters(parameters1, parameters2)).toBe(true);
  });

  it('should return true when encodings have different content in same position', () => {
    const parameters1: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [],
      encodings: [{ maxBitrate: 1_000_000, scaleResolutionDownBy: 1 }],
      rtcp: { cname: '', reducedSize: false },
    };

    const parameters2: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [],
      encodings: [{ maxBitrate: 1_000_000, scaleResolutionDownBy: 2 }],
      rtcp: { cname: '', reducedSize: false },
    };

    expect(hasChangedRTCRtpSendParameters(parameters1, parameters2)).toBe(true);
  });

  it('should return false when encodings are identical but have complex structure', () => {
    const parameters1: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [],
      encodings: [
        { maxBitrate: 1_000_000, scaleResolutionDownBy: 1, active: true },
        { maxBitrate: 500_000, scaleResolutionDownBy: 2, active: false },
      ],
      rtcp: { cname: '', reducedSize: false },
    };

    const parameters2: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [],
      encodings: [
        { maxBitrate: 1_000_000, scaleResolutionDownBy: 1, active: true },
        { maxBitrate: 500_000, scaleResolutionDownBy: 2, active: false },
      ],
      rtcp: { cname: '', reducedSize: false },
    };

    expect(hasChangedRTCRtpSendParameters(parameters1, parameters2)).toBe(false);
  });

  it('should return true when encodings have same length but different order', () => {
    const parameters1: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [],
      encodings: [
        { maxBitrate: 1_000_000, scaleResolutionDownBy: 1 },
        { maxBitrate: 500_000, scaleResolutionDownBy: 2 },
      ],
      rtcp: { cname: '', reducedSize: false },
    };

    const parameters2: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [],
      encodings: [
        { maxBitrate: 500_000, scaleResolutionDownBy: 2 },
        { maxBitrate: 1_000_000, scaleResolutionDownBy: 1 },
      ],
      rtcp: { cname: '', reducedSize: false },
    };

    expect(hasChangedRTCRtpSendParameters(parameters1, parameters2)).toBe(true);
  });

  it('should return true when rtcp properties differ', () => {
    const parameters1: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [],
      encodings: [],
      rtcp: { cname: 'test1', reducedSize: false },
    };

    const parameters2: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [],
      encodings: [],
      rtcp: { cname: 'test2', reducedSize: true },
    };

    expect(hasChangedRTCRtpSendParameters(parameters1, parameters2)).toBe(true);
  });

  it('should return true when degradationPreference differs', () => {
    const parameters1: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [],
      encodings: [],
      rtcp: { cname: '', reducedSize: false },
      degradationPreference: 'maintain-framerate',
    };

    const parameters2: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [],
      encodings: [],
      rtcp: { cname: '', reducedSize: false },
      degradationPreference: 'maintain-resolution',
    };

    expect(hasChangedRTCRtpSendParameters(parameters1, parameters2)).toBe(true);
  });

  it('should return true when rtcp cname is same but reducedSize differs', () => {
    const parameters1: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [],
      encodings: [],
      rtcp: { cname: 'test', reducedSize: false },
    };

    const parameters2: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [],
      encodings: [],
      rtcp: { cname: 'test', reducedSize: true },
    };

    expect(hasChangedRTCRtpSendParameters(parameters1, parameters2)).toBe(true);
  });

  it('should return false when encodings are undefined for both parameters', () => {
    const parameters1 = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [],
      encodings: undefined as unknown as RTCRtpEncodingParameters[],
      rtcp: { cname: '', reducedSize: false },
    } as unknown as RTCRtpSendParameters;

    const parameters2 = {
      transactionId: '1',
      codecs: [],
      headerExtensions: [],
      encodings: undefined as unknown as RTCRtpEncodingParameters[],
      rtcp: { cname: '', reducedSize: false },
    } as unknown as RTCRtpSendParameters;

    expect(hasChangedRTCRtpSendParameters(parameters1, parameters2)).toBe(false);
  });

  it('should return false when parameters are identical', () => {
    const parameters1: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [{ mimeType: 'audio/opus' }] as RTCRtpCodecParameters[],
      headerExtensions: [{ id: 1, uri: 'urn:ietf:params:rtp-hdrext:sdes:mid' }],
      encodings: [{}],
      rtcp: { cname: 'test', reducedSize: false },
    };

    const parameters2: RTCRtpSendParameters = {
      transactionId: '1',
      codecs: [{ mimeType: 'audio/opus' }] as RTCRtpCodecParameters[],
      headerExtensions: [{ id: 1, uri: 'urn:ietf:params:rtp-hdrext:sdes:mid' }],
      encodings: [{}],
      rtcp: { cname: 'test', reducedSize: false },
    };

    expect(hasChangedRTCRtpSendParameters(parameters1, parameters2)).toBe(false);
  });
});
