import type { TRtpSendParameters } from '../types';
import configureDegradationPreference from './configureDegradationPreference';
import configureEncodings from './configureEncodings';
import hasChangedRTCRtpSendParameters from './hasChangedRTCRtpSendParameters';
import type { TResult } from './types';

const setParametersToSender = async (
  sender: RTCRtpSender,
  parametersTarget: TRtpSendParameters,
): Promise<TResult> => {
  const parametersCurrent: RTCRtpSendParameters = sender.getParameters();
  // eslint-disable-next-line unicorn/prefer-structured-clone
  const parametersInitial: RTCRtpSendParameters = JSON.parse(
    JSON.stringify(parametersCurrent),
  ) as RTCRtpSendParameters;

  configureEncodings(parametersCurrent, parametersTarget);
  configureDegradationPreference(parametersCurrent, parametersTarget);

  const isChanged = hasChangedRTCRtpSendParameters(parametersInitial, parametersCurrent);

  if (isChanged) {
    await sender.setParameters(parametersCurrent);
  }

  return { parameters: parametersCurrent, isChanged };
};

export default setParametersToSender;
