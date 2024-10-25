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
): RTCRtpEncodingParameters => {
  const maxBitrateCurrent = encodingCurrent.maxBitrate;
  const maxBitrateTarget = performUpdateMaxBitrate(maxBitrate, maxBitrateCurrent);

  if (maxBitrateTarget !== undefined) {
    return { ...encodingCurrent, maxBitrate: maxBitrateTarget };
  }

  return encodingCurrent;
};

export default configureMaxBitrate;
