export type TOnAddedTransceiver = (
  transceiver: RTCRtpTransceiver,
  track: MediaStreamTrack,
  streams: MediaStream[],
) => Promise<void>;
export type TContentHint = 'motion' | 'detail' | 'text' | 'none';
