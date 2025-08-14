import setParametersToSender from './setParametersToSender';

import type { TOnSetParameters, TResultSetParametersToSender } from './types';

const setEncodingsToSender = async (
  sender: RTCRtpSender,
  encodingsTarget: { scaleResolutionDownBy?: number; maxBitrate?: number },
  onSetParameters?: TOnSetParameters,
): Promise<TResultSetParametersToSender> => {
  const { isChanged, parameters } = await setParametersToSender(sender, {
    encodings: [
      {
        scaleResolutionDownBy: encodingsTarget.scaleResolutionDownBy,
        maxBitrate: encodingsTarget.maxBitrate,
      },
    ],
  });

  if (isChanged && onSetParameters) {
    onSetParameters(parameters);
  }

  return { isChanged, parameters };
};

export default setEncodingsToSender;
