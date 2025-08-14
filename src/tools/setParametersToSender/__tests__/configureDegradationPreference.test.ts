/// <reference types="jest" />
import configureDegradationPreference from '../configureDegradationPreference';

import type { TRtpSendParameters } from '@/types';

describe('configureDegradationPreference', () => {
  it('should set the degradationPreference correctly', () => {
    const parametersCurrent: RTCRtpSendParameters = {
      encodings: [],
      transactionId: '',
      codecs: [],
      headerExtensions: [],
      rtcp: {},
      degradationPreference: 'maintain-framerate',
    };

    const parametersTarget: TRtpSendParameters = {
      encodings: [],
      codecs: [],
      headerExtensions: [],
      rtcp: {},
      degradationPreference: 'maintain-resolution',
    };

    const result = configureDegradationPreference(parametersCurrent, parametersTarget);

    expect(result.degradationPreference).toBe('maintain-resolution');
  });

  it('should not modify other parameters', () => {
    const parametersCurrent: RTCRtpSendParameters = {
      encodings: [],
      transactionId: '123',
      codecs: [],
      headerExtensions: [],
      rtcp: { cname: 'testCname' },
      degradationPreference: 'maintain-framerate',
    };

    const parametersTarget: TRtpSendParameters = {
      encodings: [],
      codecs: [],
      headerExtensions: [],
      rtcp: { cname: 'testCname' },
      degradationPreference: 'maintain-resolution',
    };

    const result = configureDegradationPreference(parametersCurrent, parametersTarget);

    expect(result.transactionId).toBe('123');
    expect(result.rtcp).toEqual({ cname: 'testCname' });
  });
});
