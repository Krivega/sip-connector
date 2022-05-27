export type TOnSetParameters = (parameters: RTCRtpSendParameters) => void;
export type TResult = { parameters: RTCRtpSendParameters; isChanged: boolean };

const MIN_SCALE_RESOLUTION_DOWN_BY = 1;
const resolveHasNeedToUpdateItemEncoding = (defaultValue: number | undefined) => {
  return (itemEncodingTarget: typeof defaultValue, itemEncodingCurrent?: number): boolean => {
    const isChangedDefaultScale =
      itemEncodingCurrent === undefined && itemEncodingTarget !== defaultValue;
    const isChangedPrevScale =
      itemEncodingCurrent !== undefined && itemEncodingTarget !== itemEncodingCurrent;

    const isNeedToChange = isChangedPrevScale || isChangedDefaultScale;

    return isNeedToChange;
  };
};

const hasNeedToUpdateScaleResolutionDownBy = resolveHasNeedToUpdateItemEncoding(
  MIN_SCALE_RESOLUTION_DOWN_BY
);
const performUpdateScaleResolutionDownBy = (
  scaleResolutionDownByTarget?: number,
  scaleResolutionDownByCurrent?: number
): number | undefined => {
  const scaleResolutionDownByTargetParsed: number | null =
    scaleResolutionDownByTarget !== undefined
      ? Math.max(scaleResolutionDownByTarget, MIN_SCALE_RESOLUTION_DOWN_BY)
      : null;

  if (
    scaleResolutionDownByTargetParsed !== null &&
    hasNeedToUpdateScaleResolutionDownBy(
      scaleResolutionDownByTargetParsed,
      scaleResolutionDownByCurrent
    )
  ) {
    return scaleResolutionDownByTargetParsed;
  }

  return undefined;
};

const hasNeedToUpdateMaxBitrate = resolveHasNeedToUpdateItemEncoding(undefined);
const performUpdateMaxBitrate = (
  maxBitrateTarget?: number,
  maxBitrateCurrent?: number
): number | undefined => {
  if (hasNeedToUpdateMaxBitrate(maxBitrateTarget, maxBitrateCurrent)) {
    return maxBitrateTarget;
  }

  return undefined;
};

const setEncodingsToSender = (
  sender: RTCRtpSender,
  encodingsTarget: { scaleResolutionDownBy?: number; maxBitrate?: number },
  onSetParameters?: TOnSetParameters
): Promise<TResult> => {
  const parameters: RTCRtpSendParameters = sender.getParameters();

  if (!parameters.encodings || parameters.encodings.length === 0) {
    parameters.encodings = [{}];
  }

  const [encoding] = parameters.encodings;
  const scaleResolutionDownByCurrent = encoding.scaleResolutionDownBy;
  const scaleResolutionDownByTarget = performUpdateScaleResolutionDownBy(
    encodingsTarget.scaleResolutionDownBy,
    scaleResolutionDownByCurrent
  );

  let isChanged = false;

  if (scaleResolutionDownByTarget !== undefined) {
    parameters.encodings[0].scaleResolutionDownBy = scaleResolutionDownByTarget;
    isChanged = true;
  }

  const maxBitrateCurrent = encoding.maxBitrate;
  const maxBitrateTarget = performUpdateMaxBitrate(encodingsTarget.maxBitrate, maxBitrateCurrent);

  if (maxBitrateTarget !== undefined) {
    parameters.encodings[0].maxBitrate = maxBitrateTarget;
    isChanged = true;
  }

  if (isChanged) {
    if (onSetParameters) {
      onSetParameters(parameters);
    }

    return sender.setParameters(parameters).then(() => {
      return { parameters, isChanged };
    });
  }

  return Promise.resolve({ parameters, isChanged });
};

export default setEncodingsToSender;
