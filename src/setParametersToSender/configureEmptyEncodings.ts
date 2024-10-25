/* eslint-disable no-param-reassign */
const configureEmptyEncodings = (
  parametersCurrent: RTCRtpSendParameters,
  count: number,
): RTCRtpSendParameters => {
  if (parametersCurrent.encodings === undefined) {
    parametersCurrent.encodings = [];
  }

  for (let index = parametersCurrent.encodings.length; index < count; index += 1) {
    parametersCurrent.encodings.push({});
  }

  return parametersCurrent;
};

export default configureEmptyEncodings;
