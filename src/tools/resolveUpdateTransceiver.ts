import setParametersToSender from '../setParametersToSender';
import type { TRtpSendParameters } from '../types';

const getCapabilityCodecs = (kind: 'audio' | 'video') => {
  const senderCapabilities = RTCRtpSender.getCapabilities(kind);
  const receiverCapabilities = RTCRtpReceiver.getCapabilities(kind);
  const senderCodecs = senderCapabilities === null ? [] : senderCapabilities.codecs;
  const receiverCodecs = receiverCapabilities === null ? [] : receiverCapabilities.codecs;

  return [...senderCodecs, ...receiverCodecs];
};

const preferCodec = (
  codecs: RTCRtpCodec[],
  preferredMimeTypesVideoCodecs: string[],
): RTCRtpCodec[] => {
  return codecs.sort((a, b) => {
    const indexA = preferredMimeTypesVideoCodecs.indexOf(a.mimeType);
    const indexB = preferredMimeTypesVideoCodecs.indexOf(b.mimeType);
    const orderA = indexA === -1 ? Number.MAX_VALUE : indexA;
    const orderB = indexB === -1 ? Number.MAX_VALUE : indexB;

    return orderA - orderB;
  });
};

const resolveUpdateTransceiver = (
  parametersTarget: TRtpSendParameters,
  preferredMimeTypesVideoCodecs?: string[],
) => {
  return async (transceiver: RTCRtpTransceiver) => {
    if (
      typeof transceiver.setCodecPreferences === 'function' &&
      preferredMimeTypesVideoCodecs !== undefined &&
      preferredMimeTypesVideoCodecs?.length > 0
    ) {
      const capabilityCodecs = getCapabilityCodecs('video');

      const sortedCodecs = preferCodec(capabilityCodecs, preferredMimeTypesVideoCodecs);

      transceiver.setCodecPreferences(sortedCodecs);
    }

    if (Object.keys(parametersTarget).length > 0) {
      await setParametersToSender(transceiver.sender, parametersTarget);
    }
  };
};

export default resolveUpdateTransceiver;
