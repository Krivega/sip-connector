import setParametersToSender from '../setParametersToSender';
import type { TRtpSendParameters } from '../types';

const mergeIntersectionCodecs = (codecs1: RTCRtpCodec[], codecs2: RTCRtpCodec[]): RTCRtpCodec[] => {
  const uniqueArray = codecs1.filter((codec) => {
    return codecs2.some((c) => {
      return (
        c.clockRate === codec.clockRate &&
        c.mimeType === codec.mimeType &&
        c.channels === codec.channels &&
        c.sdpFmtpLine === codec.sdpFmtpLine
      );
    });
  });

  return uniqueArray;
};

const getCapabilityCodecs = (kind: 'audio' | 'video') => {
  const senderCapabilities = RTCRtpSender.getCapabilities(kind);
  const receiverCapabilities = RTCRtpReceiver.getCapabilities(kind);
  const senderCodecs = senderCapabilities === null ? [] : senderCapabilities.codecs;
  const receiverCodecs = receiverCapabilities === null ? [] : receiverCapabilities.codecs;

  return mergeIntersectionCodecs(senderCodecs, receiverCodecs);
};

const preferCodecs = (
  codecs: RTCRtpCodec[],
  preferredMimeTypesVideoCodecs?: string[],
): RTCRtpCodec[] => {
  if (preferredMimeTypesVideoCodecs === undefined || preferredMimeTypesVideoCodecs.length === 0) {
    return codecs;
  }

  return codecs.sort((a, b) => {
    const indexA = preferredMimeTypesVideoCodecs.indexOf(a.mimeType);
    const indexB = preferredMimeTypesVideoCodecs.indexOf(b.mimeType);
    const orderA = indexA === -1 ? Number.MAX_VALUE : indexA;
    const orderB = indexB === -1 ? Number.MAX_VALUE : indexB;

    return orderA - orderB;
  });
};

const excludeCodecs = (codecs: RTCRtpCodec[], excludeMimeTypesVideoCodecs?: string[]) => {
  if (excludeMimeTypesVideoCodecs === undefined || excludeMimeTypesVideoCodecs.length === 0) {
    return codecs;
  }

  return codecs.filter((codec) => {
    return !excludeMimeTypesVideoCodecs.includes(codec.mimeType);
  });
};

const resolveUpdateTransceiver = (
  parametersTarget: TRtpSendParameters,
  {
    preferredMimeTypesVideoCodecs,
    excludeMimeTypesVideoCodecs,
  }: { preferredMimeTypesVideoCodecs?: string[]; excludeMimeTypesVideoCodecs?: string[] },
) => {
  return async (transceiver: RTCRtpTransceiver) => {
    if (
      typeof transceiver.setCodecPreferences === 'function' &&
      transceiver.sender.track?.kind === 'video' &&
      ((preferredMimeTypesVideoCodecs !== undefined && preferredMimeTypesVideoCodecs?.length > 0) ||
        (excludeMimeTypesVideoCodecs !== undefined && excludeMimeTypesVideoCodecs?.length > 0))
    ) {
      const capabilityCodecs = getCapabilityCodecs('video');

      const filteredCodecs = excludeCodecs(capabilityCodecs, excludeMimeTypesVideoCodecs);
      const sortedCodecs = preferCodecs(filteredCodecs, preferredMimeTypesVideoCodecs);

      transceiver.setCodecPreferences(sortedCodecs);
    }

    if (Object.keys(parametersTarget).length > 0) {
      await setParametersToSender(transceiver.sender, parametersTarget);
    }
  };
};

export default resolveUpdateTransceiver;
