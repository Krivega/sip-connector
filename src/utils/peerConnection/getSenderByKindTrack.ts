const getSenderByKindTrack = (
  connection: RTCPeerConnection,
  track: MediaStreamTrack,
): RTCRtpSender | undefined => {
  return connection.getSenders().find((sender) => {
    return sender.track !== null && sender.track.kind === track.kind;
  });
};

export default getSenderByKindTrack;
