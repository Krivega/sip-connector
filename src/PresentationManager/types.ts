export type TOnAddedTransceiver = (
  transceiver: RTCRtpTransceiver,
  track: MediaStreamTrack,
) => Promise<void>;
export type TContentHint = 'motion' | 'detail' | 'text' | 'none';
export type TMaxResolution = {
  width: number;
  height: number;
};
