/* eslint-disable no-param-reassign */
import resolveHasNeedToUpdateItemEncoding from './resolveHasNeedToUpdateItemEncoding';

const MIN_SCALE_RESOLUTION_DOWN_BY = 1;
const hasNeedToUpdateScaleResolutionDownBy = resolveHasNeedToUpdateItemEncoding(
  MIN_SCALE_RESOLUTION_DOWN_BY,
);
const performUpdateScaleResolutionDownBy = (
  scaleResolutionDownByTarget?: number,
  scaleResolutionDownByCurrent?: number,
): number | undefined => {
  const scaleResolutionDownByTargetParsed: number | undefined =
    scaleResolutionDownByTarget === undefined
      ? undefined
      : Math.max(scaleResolutionDownByTarget, MIN_SCALE_RESOLUTION_DOWN_BY);

  if (
    scaleResolutionDownByTargetParsed !== undefined &&
    hasNeedToUpdateScaleResolutionDownBy(
      scaleResolutionDownByTargetParsed,
      scaleResolutionDownByCurrent,
    )
  ) {
    return scaleResolutionDownByTargetParsed;
  }

  return undefined;
};

const configureScaleResolutionDownBy = (
  encodingCurrent: RTCRtpEncodingParameters,
  scaleResolutionDownBy?: number,
) => {
  const scaleResolutionDownByCurrent = encodingCurrent.scaleResolutionDownBy;
  const scaleResolutionDownByTarget = performUpdateScaleResolutionDownBy(
    scaleResolutionDownBy,
    scaleResolutionDownByCurrent,
  );

  if (scaleResolutionDownByTarget !== undefined) {
    encodingCurrent.scaleResolutionDownBy = scaleResolutionDownByTarget;
  }

  return encodingCurrent;
};

export default configureScaleResolutionDownBy;
