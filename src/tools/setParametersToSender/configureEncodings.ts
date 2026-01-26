import configureEmptyEncodings from './configureEmptyEncodings';
import configureMaxBitrate from './configureMaxBitrate';
import configureScaleResolutionDownBy from './configureScaleResolutionDownBy';

import type { TRtpSendParameters } from '@/types';

const configureEncodings = (
  parametersCurrent: RTCRtpSendParameters,
  parametersTarget: TRtpSendParameters,
  { isResetAllowed }: { isResetAllowed?: boolean } = {},
) => {
  const countEncodingsTarget = parametersTarget.encodings?.length ?? 0;

  configureEmptyEncodings(parametersCurrent, countEncodingsTarget);

  parametersCurrent.encodings.forEach((encoding, index) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const encodingTarget = (parametersTarget?.encodings ?? [])[index] as
      | RTCRtpEncodingParameters
      | undefined;
    const maxBitrate = encodingTarget?.maxBitrate;
    const scaleResolutionDownBy = encodingTarget?.scaleResolutionDownBy;

    configureMaxBitrate(encoding, maxBitrate, { isResetAllowed });
    configureScaleResolutionDownBy(encoding, scaleResolutionDownBy);
  });

  return parametersCurrent;
};

export default configureEncodings;
