export type TOnAddedTransceiver = (
  transceiver: RTCRtpTransceiver,
  track: MediaStreamTrack,
  stream: MediaStream,
) => Promise<void>;
export type TContentHint = 'motion' | 'detail' | 'text' | 'none';
