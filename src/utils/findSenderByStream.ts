const findSenderByStream = (
  senders: RTCRtpSender[],
  stream: MediaStream,
): RTCRtpSender | undefined => {
  return senders.find((sender) => {
    return sender.track && stream.getTracks().includes(sender.track);
  });
};

export default findSenderByStream;
