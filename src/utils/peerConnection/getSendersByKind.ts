/**
 * Находит все RTCRtpSender'ы для указанного типа медиа
 */
const getSendersByKind = (
  connection: RTCPeerConnection,
  kind: 'audio' | 'video',
): RTCRtpSender[] => {
  return connection.getSenders().filter((sender) => {
    return sender.track?.kind === kind;
  });
};

export default getSendersByKind;
