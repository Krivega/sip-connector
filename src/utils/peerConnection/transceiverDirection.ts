export const setTransceiverDirection = (
  transceiver: RTCRtpTransceiver,
  direction: RTCRtpTransceiverDirection,
): void => {
  // @ts-expect-error — setDirection есть не во всех браузерах
  if (typeof transceiver.setDirection === 'function') {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    transceiver.setDirection(direction);

    return;
  }

  // eslint-disable-next-line no-param-reassign
  (transceiver as { direction: RTCRtpTransceiverDirection }).direction = direction;
};
