/// <reference types="jest" />
import configureEncodings from '../configureEncodings';

import type { TRtpSendParameters } from '../../types';

describe('configureEncodings', () => {
  it('should configure encodings correctly', () => {
    const parametersCurrent: RTCRtpSendParameters = {
      transactionId: '1',
      encodings: [{ maxBitrate: 500_000 }],
      codecs: [],
      headerExtensions: [],
      rtcp: { cname: '', reducedSize: false },
    };
    const parametersTarget: TRtpSendParameters = {
      encodings: [{ maxBitrate: 1_000_000, scaleResolutionDownBy: 2 }],
    };

    const result = configureEncodings(parametersCurrent, parametersTarget);

    expect(result.encodings).toEqual([{ maxBitrate: 1_000_000, scaleResolutionDownBy: 2 }]);
  });

  it('should handle empty encodings correctly', () => {
    const parametersCurrent: RTCRtpSendParameters = {
      transactionId: '1',
      encodings: [],
      codecs: [],
      headerExtensions: [],
      rtcp: { cname: '', reducedSize: false },
    };
    const parametersTarget: TRtpSendParameters = {
      encodings: [{ maxBitrate: 1_000_000, scaleResolutionDownBy: 2 }],
    };

    const result = configureEncodings(parametersCurrent, parametersTarget);

    expect(result.encodings).toEqual([{ maxBitrate: 1_000_000, scaleResolutionDownBy: 2 }]);
  });

  it('should return current parameters if target encodings are undefined', () => {
    const parametersCurrent: RTCRtpSendParameters = {
      transactionId: '1',
      encodings: [{ maxBitrate: 500_000 }],
      codecs: [],
      headerExtensions: [],
      rtcp: { cname: '', reducedSize: false },
    };
    const parametersTarget: TRtpSendParameters = {};

    const result = configureEncodings(parametersCurrent, parametersTarget);

    expect(result).toEqual(parametersCurrent);
  });
});
