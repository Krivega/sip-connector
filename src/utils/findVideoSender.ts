const findVideoSender = (senders: RTCRtpSender[]): RTCRtpSender | undefined => {
  return senders.find((sender) => {
    return sender.track?.kind === 'video';
  });
};

export default findVideoSender;
