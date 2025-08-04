const findSenderByStream = (
  senders: RTCRtpSender[],
  stream: MediaStream,
): RTCRtpSender | undefined => {
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  return senders.find((sender) => {
    return sender.track && stream.getTracks().includes(sender.track);
  });
};

export default findSenderByStream;
