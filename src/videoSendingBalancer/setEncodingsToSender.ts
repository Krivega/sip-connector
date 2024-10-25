import setParametersToSender from '../setParametersToSender';

export type TOnSetParameters = (parameters: RTCRtpSendParameters) => void;
export type TResult = { parameters: RTCRtpSendParameters; isChanged: boolean };

const setEncodingsToSender = async (
  sender: RTCRtpSender,
  encodingsTarget: { scaleResolutionDownBy?: number; maxBitrate?: number },
  onSetParameters?: TOnSetParameters,
): Promise<TResult> => {
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
