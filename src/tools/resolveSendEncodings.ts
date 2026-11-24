import { calcScaleResolutionDownBy } from '@/VideoSendingBalancer/calcResolution';

import type { TResolutionSize } from '@/types';

const SCALE_RESOLUTION_DOWN_BY_MIN = 1;

type TParameters = {
  videoTrack: MediaStreamVideoTrack;
  sendEncodings?: RTCRtpEncodingParameters[];
  maxResolution?: TResolutionSize;
  minScaleResolutionDownBy?: number;
};

const resolveScaleResolutionDownByEncoding = (
  encoding: RTCRtpEncodingParameters,
  scaleResolutionDownBy: number,
): RTCRtpEncodingParameters => {
  if (scaleResolutionDownBy <= SCALE_RESOLUTION_DOWN_BY_MIN) {
    return {
      ...encoding,
      scaleResolutionDownBy: SCALE_RESOLUTION_DOWN_BY_MIN,
    };
  }

  return {
    ...encoding,
    scaleResolutionDownBy: Math.max(
      encoding.scaleResolutionDownBy ?? SCALE_RESOLUTION_DOWN_BY_MIN,
      scaleResolutionDownBy,
    ),
  };
};

const resolveSendEncodings = ({
  videoTrack,
  sendEncodings,
  maxResolution,
  minScaleResolutionDownBy = SCALE_RESOLUTION_DOWN_BY_MIN,
}: TParameters): RTCRtpEncodingParameters[] | undefined => {
  if (maxResolution === undefined && minScaleResolutionDownBy <= SCALE_RESOLUTION_DOWN_BY_MIN) {
    return sendEncodings;
  }

  const scaleResolutionDownBy = Math.max(
    maxResolution === undefined
      ? SCALE_RESOLUTION_DOWN_BY_MIN
      : calcScaleResolutionDownBy({ videoTrack, targetSize: maxResolution }),
    minScaleResolutionDownBy,
  );

  if (sendEncodings === undefined || sendEncodings.length === 0) {
    return [{ scaleResolutionDownBy }];
  }

  return sendEncodings.map((encoding) => {
    return resolveScaleResolutionDownByEncoding(encoding, scaleResolutionDownBy);
  });
};

export default resolveSendEncodings;
