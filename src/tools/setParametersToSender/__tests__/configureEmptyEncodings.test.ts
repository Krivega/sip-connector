/// <reference types="jest" />
import configureEmptyEncodings from '../configureEmptyEncodings';

describe('configureEmptyEncodings', () => {
  it('should add empty encodings if encodings are undefined', () => {
    const count = 3;
    const parametersCurrent: RTCRtpSendParameters = {
      transactionId: '1',
      // @ts-expect-error
      encodings: undefined,
      codecs: [],
      headerExtensions: [],
      rtcp: { cname: '', reducedSize: false },
    };

    const result = configureEmptyEncodings(parametersCurrent, count);

    expect(result.encodings).toHaveLength(count);
    expect(result.encodings).toEqual([{}, {}, {}]);
  });

  it('should add empty encodings if encodings length is less than count', () => {
    const count = 3;
    const parametersCurrent: RTCRtpSendParameters = {
      transactionId: '1',
      encodings: [{}] as RTCRtpEncodingParameters[],
      codecs: [],
      headerExtensions: [],
      rtcp: { cname: '', reducedSize: false },
    };

    const result = configureEmptyEncodings(parametersCurrent, count);

    expect(result.encodings).toHaveLength(count);
    expect(result.encodings).toEqual([{}, {}, {}]);
  });

  it('should not add encodings if encodings length is equal to count', () => {
    const count = 2;
    const parametersCurrent: RTCRtpSendParameters = {
      transactionId: '1',
      encodings: [{}, {}],
      codecs: [],
      headerExtensions: [],
      rtcp: { cname: '', reducedSize: false },
    };

    const result = configureEmptyEncodings(parametersCurrent, count);

    expect(result.encodings).toHaveLength(count);
    expect(result.encodings).toEqual([{}, {}]);
  });

  it('should not add encodings if encodings length is greater than count', () => {
    const count = 1;
    const parametersCurrent: RTCRtpSendParameters = {
      transactionId: '1',
      encodings: [{}, {}],
      codecs: [],
      headerExtensions: [],
      rtcp: { cname: '', reducedSize: false },
    };

    const result = configureEmptyEncodings(parametersCurrent, count);

    expect(result.encodings).toHaveLength(2);
    expect(result.encodings).toEqual([{}, {}]);
  });
});
