const configureEmptyEncodings = (
  parametersCurrent: RTCRtpSendParameters,
  count: number,
): RTCRtpSendParameters => {
  let { encodings } = parametersCurrent;

  if (encodings === undefined) {
    encodings = [];
  }

  for (let index = encodings.length; index < count; index += 1) {
    encodings.push({});
  }

  return { ...parametersCurrent, encodings };
};

export default configureEmptyEncodings;
