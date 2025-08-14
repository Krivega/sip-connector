/* eslint-disable no-param-reassign */
import type { TRtpSendParameters } from '@/types';

const configureDegradationPreference = (
  parametersCurrent: RTCRtpSendParameters,
  parametersTarget: TRtpSendParameters,
): RTCRtpSendParameters => {
  parametersCurrent.degradationPreference = parametersTarget.degradationPreference;

  return parametersCurrent;
};

export default configureDegradationPreference;
