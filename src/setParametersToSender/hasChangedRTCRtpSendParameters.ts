const hasChangedRTCRtpSendParameters = (
  parameters1: RTCRtpSendParameters,
  parameters2: RTCRtpSendParameters,
): boolean => {
  // Сравниваем кодеки
  if (parameters1.codecs?.length !== parameters2.codecs?.length) {
    return true;
  }

  for (let index = 0; index < (parameters1.codecs?.length ?? 0); index++) {
    if (JSON.stringify(parameters1.codecs[index]) !== JSON.stringify(parameters2.codecs[index])) {
      return true;
    }
  }

  // Сравниваем заголовки RTP
  if (parameters1.headerExtensions?.length !== parameters2.headerExtensions?.length) {
    return true;
  }

  for (let index = 0; index < (parameters1.headerExtensions?.length ?? 0); index++) {
    if (
      JSON.stringify(parameters1.headerExtensions[index]) !==
      JSON.stringify(parameters2.headerExtensions[index])
    ) {
      return true;
    }
  }

  // Сравниваем параметры RTP
  if (parameters1.encodings?.length !== parameters2.encodings?.length) {
    return true;
  }

  for (let index = 0; index < (parameters1.encodings.length ?? 0); index++) {
    if (
      JSON.stringify(parameters1.encodings[index]) !== JSON.stringify(parameters2.encodings[index])
    ) {
      return true;
    }
  }

  // Сравниваем общие параметры
  if (parameters1.rtcp.cname !== parameters2.rtcp.cname) {
    return true;
  }

  if (parameters1.rtcp.reducedSize !== parameters2.rtcp.reducedSize) {
    return true;
  }

  // Сравниваем параметры degradationPreference
  if (parameters1.degradationPreference !== parameters2.degradationPreference) {
    return true;
  }

  // Если все параметры совпадают, возвращаем false
  return false;
};

export default hasChangedRTCRtpSendParameters;
