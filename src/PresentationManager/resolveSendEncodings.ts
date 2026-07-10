import findVideoTrack from '@/utils/findVideoTrack';
import { calcScaleResolutionDownBy } from '@/VideoSendingBalancer/calcResolution';

import type { TMaxResolution } from './types';

const SCALE_RESOLUTION_DOWN_BY_MIN = 1;

type TParameters = {
  stream: MediaStream;
  sendEncodings?: RTCRtpEncodingParameters[];
  maxResolution?: TMaxResolution;
};

const resolveScaleResolutionDownByEncoding = (
  encoding: RTCRtpEncodingParameters,
  scaleResolutionDownBy: number,
): RTCRtpEncodingParameters => {
  return {
    ...encoding,
    scaleResolutionDownBy: Math.max(
      encoding.scaleResolutionDownBy ?? SCALE_RESOLUTION_DOWN_BY_MIN,
      scaleResolutionDownBy,
    ),
  };
};

const applyScaleToSendEncodings = (
  sendEncodings: RTCRtpEncodingParameters[] | undefined,
  scaleResolutionDownBy: number,
): RTCRtpEncodingParameters[] => {
  if (sendEncodings === undefined || sendEncodings.length === 0) {
    return [{ scaleResolutionDownBy }];
  }

  return sendEncodings.map((encoding) => {
    return resolveScaleResolutionDownByEncoding(encoding, scaleResolutionDownBy);
  });
};

const getTargetScale = (scaleResolutionDownBy: number): number => {
  return scaleResolutionDownBy <= SCALE_RESOLUTION_DOWN_BY_MIN
    ? SCALE_RESOLUTION_DOWN_BY_MIN
    : scaleResolutionDownBy;
};

const resolveSendEncodings = ({
  stream,
  sendEncodings,
  maxResolution,
}: TParameters): RTCRtpEncodingParameters[] | undefined => {
  if (maxResolution === undefined) {
    return sendEncodings;
  }

  const videoTrack = findVideoTrack(stream);

  if (videoTrack === undefined) {
    return sendEncodings;
  }

  const scaleResolutionDownBy = calcScaleResolutionDownBy({
    videoTrack,
    targetSize: maxResolution,
  });

  const targetScale = getTargetScale(scaleResolutionDownBy);

  return applyScaleToSendEncodings(sendEncodings, targetScale);
};

export default resolveSendEncodings;
