const findSenderByTrack = (
  connection: RTCPeerConnection,
  track: MediaStreamTrack,
): RTCRtpSender | undefined => {
  return connection.getSenders().find((sender) => {
    return sender.track === track;
  });
};

export default findSenderByTrack;
