/* eslint-disable no-param-reassign */
import resolveHasNeedToUpdateItemEncoding from './resolveHasNeedToUpdateItemEncoding';

const hasNeedToUpdateMaxBitrate = resolveHasNeedToUpdateItemEncoding();
const performUpdateMaxBitrate = (
  maxBitrateTarget?: number,
  maxBitrateCurrent?: number,
): number | undefined => {
  if (hasNeedToUpdateMaxBitrate(maxBitrateTarget, maxBitrateCurrent)) {
    return maxBitrateTarget;
  }

  return undefined;
};

const configureMaxBitrate = (
  encodingCurrent: RTCRtpEncodingParameters,
  maxBitrate?: number,
  { isResetAllowed = false }: { isResetAllowed?: boolean } = {},
): RTCRtpEncodingParameters => {
  const maxBitrateCurrent = encodingCurrent.maxBitrate;
  const maxBitrateTarget = performUpdateMaxBitrate(maxBitrate, maxBitrateCurrent);

  if (maxBitrateTarget !== undefined || isResetAllowed) {
    encodingCurrent.maxBitrate = maxBitrateTarget;
  }

  return encodingCurrent;
};

export default configureMaxBitrate;
