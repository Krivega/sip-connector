const findVideoSender = (senders: RTCRtpSender[]): RTCRtpSender | undefined => {
  return senders.find((sender) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return sender?.track?.kind === 'video';
  });
};

export default findVideoSender;
