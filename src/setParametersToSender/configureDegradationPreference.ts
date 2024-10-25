import type { TRtpSendParameters } from '../types';

const configureDegradationPreference = (
  parametersCurrent: RTCRtpSendParameters,
  parametersTarget: TRtpSendParameters,
): RTCRtpSendParameters => {
  return { ...parametersCurrent, degradationPreference: parametersTarget.degradationPreference };
};

export default configureDegradationPreference;
