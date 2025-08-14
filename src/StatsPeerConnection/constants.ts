export const INTERVAL_COLLECT_STATISTICS = 1000;

export enum EStatsTypes {
  INBOUND_RTP = 'inbound-rtp',
  REMOTE_OUTBOUND_RTP = 'remote-outbound-rtp',
  MEDIA_SOURCE = 'media-source',
  OUTBOUND_RTP = 'outbound-rtp',
  REMOTE_INBOUND_RTP = 'remote-inbound-rtp',
  CODEC = 'codec',
  CANDIDATE_PAIR = 'candidate-pair',
  CERTIFICATE = 'certificate',
  TRANSPORT = 'transport',
  LOCAL_CANDIDATE = 'local-candidate',
  REMOTE_CANDIDATE = 'remote-candidate',
}
