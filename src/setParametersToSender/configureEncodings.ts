import type { TRtpSendParameters } from '../types';
import configureEmptyEncodings from './configureEmptyEncodings';
import configureMaxBitrate from './configureMaxBitrate';
import configureScaleResolutionDownBy from './configureScaleResolutionDownBy';

const configureEncodings = (
  parametersCurrent: RTCRtpSendParameters,
  parametersTarget: TRtpSendParameters,
) => {
  const countEncodingsTarget = parametersTarget.encodings?.length ?? 0;

  configureEmptyEncodings(parametersCurrent, countEncodingsTarget);

  parametersCurrent.encodings.forEach((encoding, index) => {
    const encodingTarget = (parametersTarget?.encodings ?? [])[index];
    const maxBitrate = encodingTarget?.maxBitrate;
    const scaleResolutionDownBy = encodingTarget?.scaleResolutionDownBy;

    configureMaxBitrate(encoding, maxBitrate);
    configureScaleResolutionDownBy(encoding, scaleResolutionDownBy);
  });

  return parametersCurrent;
};

export default configureEncodings;
