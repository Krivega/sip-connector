import type { EStatsTypes } from './constants';

export type TMedia = {
  trackIdentifier?: string;
  item?: RTCRtpSynchronizationSource;
};

export type TSynchronizationSources = {
  audio: TMedia;
  video: TMedia;
};

export type TCandidatePair = RTCIceCandidatePairStats & {
  consentRequestsSent?: number;
  nominated?: boolean;
  packetsDiscardedOnSend?: number;
  packetsSent?: number;
  priority?: number;
  writable?: boolean;
};

export type TCandidate = {
  candidateType?: string;
  ip?: string;
  networkType?: string;
  isRemote?: boolean;
  address?: string;
  component?: RTCIceComponent;
  foundation?: string;
  port?: number;
  priority?: number;
  protocol?: RTCIceProtocol;
  relatedAddress?: string;
  relatedPort?: number;
  sdpMLineIndex?: number;
  sdpMid?: string;
  tcpType?: string;
  usernameFragment?: string;
};

export type TOutboundRtp = RTCOutboundRtpStreamStats & {
  active?: boolean;
  encoderImplementation?: string;
  frameHeight?: number;
  contentType?: string;
  frameWidth?: number;
  framesPerSecond?: number;
  framesSent?: number;
  hugeFramesSent?: number;
  keyFramesEncoded?: number;
  headerBytesSent?: number;
  qualityLimitationDurations?: {
    bandwidth?: number;
    cpu?: number;
    none?: number;
    other?: number;
  };
  qualityLimitationReason?: string;
  qualityLimitationResolutionChanges?: number;
  mediaSourceId?: string;
  mediaType?: string;
  mid?: string;
  retransmittedBytesSent?: number;
  retransmittedPacketsSent?: number;
  totalEncodeTime?: number;
  totalEncodedBytesTarget?: number;
  totalPacketSendDelay?: number;
  targetBitrate?: number;
  trackId?: string;
};

export type TMediaSource = {
  audioLevel?: number;
  frames?: number;
  framesPerSecond?: number;
  height?: number;
  width?: number;
  totalAudioEnergy?: number;
  totalSamplesDuration?: number;
  trackIdentifier?: string;
};

export type TCertificate = {
  base64Certificate?: string;
  fingerprint?: string;
  fingerprintAlgorithm?: string;
};

export type TRemoteInboundRtp = {
  codecId?: string;
  fractionLost?: number;
  jitter?: number;
  localId?: string;
  packetsLost?: number;
  roundTripTime?: number;
  roundTripTimeMeasurements?: number;
  ssrc?: number;
  totalRoundTripTime?: number;
  transportId?: string;
};

export type TRemoteOutboundRtp = {
  bytesSent?: number;
  codecId?: string;
  localId?: string;
  packetsSent?: number;
  remoteTimestamp?: number;
  reportsSent?: number;
  roundTripTimeMeasurements?: number;
  ssrc?: number;
  totalRoundTripTime?: number;
  transportId?: string;
};

export type TOutboundVideo = {
  outboundRtp?: TOutboundRtp;
  mediaSource?: TMediaSource;
  codec?: RTCRtpCodecParameters;
  remoteInboundRtp?: TRemoteInboundRtp;
};

export type TOutboundAudio = {
  outboundRtp?: TOutboundRtp;
  mediaSource?: TMediaSource;
  codec?: RTCRtpCodecParameters;
  remoteInboundRtp?: TRemoteInboundRtp;
};

export type TAdditional = {
  candidatePair?: TCandidatePair;
  certificate?: TCertificate;
  localCandidate?: TCandidate;
  remoteCandidate?: TCandidate;
  transport?: RTCTransportStats;
};

export type TInboundVideo = {
  inboundRtp?: RTCInboundRtpStreamStats;
  codec?: RTCRtpCodecParameters;
  synchronizationSources?: TMedia;
};

export type TInboundAudio = {
  inboundRtp?: RTCInboundRtpStreamStats;
  codec?: RTCRtpCodecParameters;
  remoteOutboundRtp?: TRemoteOutboundRtp;
  synchronizationSources?: TMedia;
};

export type TInboundStats = {
  video: TInboundVideo;
  secondVideo: TInboundVideo;
  audio: TInboundAudio;
  additional: TAdditional;
};

export type TOutboundStats = {
  video: TOutboundVideo;
  secondVideo: TOutboundVideo;
  audio: TOutboundAudio;
  additional: TAdditional;
};

export type TAudioStatistics = {
  [EStatsTypes.OUTBOUND_RTP]?: TOutboundRtp;
  [EStatsTypes.CODEC]?: RTCRtpCodecParameters;
  [EStatsTypes.MEDIA_SOURCE]?: TMediaSource;
  [EStatsTypes.REMOTE_INBOUND_RTP]?: TRemoteInboundRtp;
  [EStatsTypes.INBOUND_RTP]?: RTCInboundRtpStreamStats;
  [EStatsTypes.REMOTE_OUTBOUND_RTP]?: TRemoteOutboundRtp;
};

export type TVideoStatistics = {
  [EStatsTypes.OUTBOUND_RTP]?: TOutboundRtp;
  [EStatsTypes.CODEC]?: RTCRtpCodecParameters;
  [EStatsTypes.MEDIA_SOURCE]?: TMediaSource;
  [EStatsTypes.REMOTE_INBOUND_RTP]?: TRemoteInboundRtp;
  [EStatsTypes.INBOUND_RTP]?: RTCInboundRtpStreamStats;
};

export type TParsedStatistics = {
  [EStatsTypes.CANDIDATE_PAIR]?: TCandidatePair;
  [EStatsTypes.CERTIFICATE]?: TCertificate;
  [EStatsTypes.LOCAL_CANDIDATE]?: TCandidate;
  [EStatsTypes.REMOTE_CANDIDATE]?: TCandidate;
  [EStatsTypes.TRANSPORT]?: RTCTransportStats;
};
