import findVideoTrack from '@/utils/findVideoTrack';
import { calcScaleResolutionDownBy } from '@/VideoSendingBalancer/calcResolution';

import type { TMaxAvailableResolution } from '@/ConnectionManager';

const SCALE_RESOLUTION_DOWN_BY_MIN = 1;

type TParameters = {
  mediaStream: MediaStream;
  sendEncodings?: RTCRtpEncodingParameters[];
  maxAvailableResolution?: TMaxAvailableResolution;
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

const resolvePresentationSendEncodings = ({
  mediaStream,
  sendEncodings,
  maxAvailableResolution,
}: TParameters): RTCRtpEncodingParameters[] | undefined => {
  if (maxAvailableResolution === undefined) {
    return sendEncodings;
  }

  const videoTrack = findVideoTrack(mediaStream);

  if (videoTrack === undefined) {
    return sendEncodings;
  }

  const scaleResolutionDownBy = calcScaleResolutionDownBy({
    videoTrack,
    targetSize: maxAvailableResolution,
  });

  if (scaleResolutionDownBy <= SCALE_RESOLUTION_DOWN_BY_MIN) {
    return sendEncodings;
  }

  if (sendEncodings === undefined || sendEncodings.length === 0) {
    return [{ scaleResolutionDownBy }];
  }

  return sendEncodings.map((encoding) => {
    return resolveScaleResolutionDownByEncoding(encoding, scaleResolutionDownBy);
  });
};

export default resolvePresentationSendEncodings;
