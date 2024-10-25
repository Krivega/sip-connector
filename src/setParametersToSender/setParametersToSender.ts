import type { TRtpSendParameters } from '../types';
import configureDegradationPreference from './configureDegradationPreference';
import configureEncodings from './configureEncodings';
import hasChangedRTCRtpSendParameters from './hasChangedRTCRtpSendParameters';

type TResult = { parameters: RTCRtpSendParameters; isChanged: boolean };

const setParametersToSender = async (
  sender: RTCRtpSender,
  parametersTarget: TRtpSendParameters,
): Promise<TResult> => {
  const parametersCurrent: RTCRtpSendParameters = sender.getParameters();
  let parametersModified = configureEncodings(parametersCurrent, parametersTarget);

  parametersModified = configureDegradationPreference(parametersModified, parametersTarget);

  const isChanged = hasChangedRTCRtpSendParameters(parametersCurrent, parametersModified);

  if (isChanged) {
    await sender.setParameters(parametersModified);
  }

  return { parameters: parametersModified, isChanged };
};

export default setParametersToSender;
