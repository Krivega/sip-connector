export type TOnAddedTransceiver = (
  transceiver: RTCRtpTransceiver,
  track: MediaStreamTrack,
) => Promise<void>;

export type TSenderOptions = {
  sendEncodings?: RTCRtpEncodingParameters[];
  degradationPreference?: RTCDegradationPreference;
};

export type TTransceiverOptions = {
  direction?: RTCRtpTransceiverDirection;
  onAddedTransceiver?: TOnAddedTransceiver;
} & TSenderOptions;

export type TContentHint = 'motion' | 'detail' | 'text' | 'none';
