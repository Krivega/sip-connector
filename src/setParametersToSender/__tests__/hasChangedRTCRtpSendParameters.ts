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
