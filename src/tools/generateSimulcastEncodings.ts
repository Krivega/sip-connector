import type { TSimulcastEncoding } from '../types';
import findVideoTrack from '../utils/findVideoTrack';
import scaleResolutionAndBitrate from './scaleResolutionAndBitrate';

const generateSimulcastEncodings = ({
  mediaStream,
  simulcastEncodings,
  sendEncodings,
}: {
  mediaStream: MediaStream;
  simulcastEncodings?: TSimulcastEncoding[];
  sendEncodings?: RTCRtpEncodingParameters[];
}) => {
  if (simulcastEncodings && simulcastEncodings.length > 0) {
    const sendEncodingsGenerated: RTCRtpEncodingParameters[] = sendEncodings ?? [];
    const videoTrack = findVideoTrack(mediaStream);

    if (videoTrack === undefined) {
      throw new Error('No video track');
    }

    simulcastEncodings.forEach((item, index) => {
      const encoding = sendEncodingsGenerated[index] ?? ({} as RTCRtpEncodingParameters);

      encoding.active = true;

      if (item.rid !== undefined) {
        encoding.rid = item.rid;
      }

      if (item.scalabilityMode !== undefined) {
        // @ts-expect-error
        encoding.scalabilityMode = item.scalabilityMode;
      }

      const { maxBitrate, scaleResolutionDownBy } = scaleResolutionAndBitrate({
        videoTrack,
        targetSize: {
          width: item.width,
          height: item.height,
        },
      });

      encoding.maxBitrate = maxBitrate;
      encoding.scaleResolutionDownBy = scaleResolutionDownBy;

      sendEncodingsGenerated[index] = encoding;
    });

    return sendEncodingsGenerated;
  }

  return sendEncodings;
};

export default generateSimulcastEncodings;
