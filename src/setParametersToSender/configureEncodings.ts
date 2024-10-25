import type { TRtpSendParameters } from '../types';
import configureEmptyEncodings from './configureEmptyEncodings';
import configureMaxBitrate from './configureMaxBitrate';
import configureScaleResolutionDownBy from './configureScaleResolutionDownBy';

const configureEncodings = (
  parametersCurrent: RTCRtpSendParameters,
  parametersTarget: TRtpSendParameters,
) => {
  const countEncodingsTarget = parametersTarget.encodings?.length ?? 0;
  const parametersModified = configureEmptyEncodings(parametersCurrent, countEncodingsTarget);

  const encodings = parametersModified.encodings.map((encoding, index) => {
    const encodingTarget = (parametersTarget?.encodings ?? [])[index];
    const maxBitrate = encodingTarget?.maxBitrate;
    const scaleResolutionDownBy = encodingTarget?.scaleResolutionDownBy;

    let encodingModified = configureMaxBitrate(encoding, maxBitrate);

    encodingModified = configureScaleResolutionDownBy(encodingModified, scaleResolutionDownBy);

    return encodingModified;
  });

  return { ...parametersModified, encodings };
};

export default configureEncodings;
