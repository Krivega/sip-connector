import type { TSimulcastEncodings } from '../types';
import findVideoTrack from '../utils/findVideoTrack';
import scaleResolutionAndBitrate from '../videoSendingBalancer/scaleResolutionAndBitrate';

const generateSimulcastEncodings = ({
  mediaStream,
  simulcastEncodings,
  sendEncodings,
}: {
  mediaStream: MediaStream;
  simulcastEncodings?: TSimulcastEncodings;
  sendEncodings?: RTCRtpEncodingParameters[];
}) => {
  if (simulcastEncodings && simulcastEncodings.length > 0) {
    const sendEncodingsGenerated: RTCRtpEncodingParameters[] = sendEncodings ?? [];
    const videoTrack = findVideoTrack(mediaStream)!;

    simulcastEncodings.forEach((item, index) => {
      const encoding = sendEncodingsGenerated[index] ?? ({} as RTCRtpEncodingParameters);

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
