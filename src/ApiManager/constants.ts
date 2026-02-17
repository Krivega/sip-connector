/* eslint-disable @typescript-eslint/prefer-literal-enum-member */

export enum EContentParticipantType {
  SPECTATOR = 'SPECTATOR',
  PARTICIPANT = 'PARTICIPANT',
}

export enum EContentTypeReceived {
  SHARE_STATE = 'application/vinteo.webrtc.sharedesktop',
  MAIN_CAM = 'application/vinteo.webrtc.maincam',
  ENTER_ROOM = 'application/vinteo.webrtc.roomname',
  MIC = 'application/vinteo.webrtc.mic',
  USE_LICENSE = 'application/vinteo.webrtc.uselic',
  PARTICIPANT_STATE = 'application/vinteo.webrtc.partstate',
  NOTIFY = 'application/vinteo.webrtc.notify',
}

export enum EContentTypeSent {
  SHARE_STATE = 'application/vinteo.webrtc.sharedesktop',
  MAIN_CAM = 'application/vinteo.webrtc.maincam',
  CHANNELS = 'application/vinteo.webrtc.channels',
  MEDIA_STATE = 'application/vinteo.webrtc.mediastate',
  REFUSAL = 'application/vinteo.webrtc.refusal',
  STATS = 'application/vinteo.webrtc.stats',
}

export enum EContentMainCAM {
  PAUSE_MAIN_CAM = 'PAUSEMAINCAM',
  RESUME_MAIN_CAM = 'RESUMEMAINCAM',
  MAX_MAIN_CAM_RESOLUTION = 'MAXMAINCAMRESOLUTION',
  ADMIN_STOP_MAIN_CAM = 'ADMINSTOPMAINCAM',
  ADMIN_START_MAIN_CAM = 'ADMINSTARTMAINCAM',
}

export enum EContentMic {
  ADMIN_STOP_MIC = 'ADMINSTOPMIC',
  ADMIN_START_MIC = 'ADMINSTARTMIC',
}

export enum EContentedStreamCodec {
  H264 = 'H264',
  VP8 = 'VP8',
  VP9 = 'VP9',
  AV1 = 'AV1',
}

export enum EKeyHeader {
  CONTENT_TYPE = 'content-type',
  CONTENT_ENTER_ROOM = 'x-webrtc-enter-room',
  CONTENT_USE_LICENSE = 'x-webrtc-use-license',
  PARTICIPANT_NAME = 'x-webrtc-participant-name',
  INPUT_CHANNELS = 'x-webrtc-input-channels',
  OUTPUT_CHANNELS = 'x-webrtc-output-channels',
  MAIN_CAM = 'x-webrtc-maincam',
  MIC = 'x-webrtc-mic',
  MEDIA_SYNC = 'x-webrtc-sync',
  MAIN_CAM_RESOLUTION = 'x-webrtc-maincam-resolution',
  MEDIA_STATE = 'x-webrtc-media-state',
  MEDIA_TYPE = 'x-vinteo-media-type',
  MAIN_CAM_STATE = 'x-vinteo-maincam-state',
  MIC_STATE = 'x-vinteo-mic-state',
  CONTENT_PARTICIPANT_STATE = 'x-webrtc-partstate',
  NOTIFY = 'x-vinteo-notify',
  CONTENT_ENABLE_MEDIA_DEVICE = 'x-webrtc-request-enable-media-device',
  CONTENTED_STREAM_STATE = 'x-webrtc-share-state',
  CONTENTED_STREAM_CODEC = 'x-webrtc-share-codec',
  AVAILABLE_INCOMING_BITRATE = 'x-webrtc-available-incoming-bitrate',
  AUDIO_TRACK_COUNT = 'x-webrtc-audio-track-count',
  VIDEO_TRACK_COUNT = 'x-webrtc-video-track-count',
  TRACKS_DIRECTION = 'x-webrtc-tracks-direction',
  AUDIO_ID = 'x-webrtc-audioid',
  BEARER_TOKEN = 'x-bearer-token',
  IS_DIRECT_PEER_TO_PEER = 'x-webrtc-is-direct-p2p',
}

enum EContentContentedStreamSend {
  ACK_PERMISSION_TO_START_PRESENTATION = 'LETMESTARTPRESENTATION',
  STOPPED_CLIENT_PRESENTATION = 'STOPPRESENTATION',
}

export enum EContentedStreamSendAndReceive {
  AVAILABLE_CONTENTED_STREAM = 'YOUCANRECEIVECONTENT',
  NOT_AVAILABLE_CONTENTED_STREAM = 'CONTENTEND',
  MUST_STOP_PRESENTATION = 'YOUMUSTSTOPSENDCONTENT',
}

export enum EHeader {
  AVAILABLE_CONTENTED_STREAM = `${EKeyHeader.CONTENTED_STREAM_STATE}: ${EContentedStreamSendAndReceive.AVAILABLE_CONTENTED_STREAM}`,
  NOT_AVAILABLE_CONTENTED_STREAM = `${EKeyHeader.CONTENTED_STREAM_STATE}: ${EContentedStreamSendAndReceive.NOT_AVAILABLE_CONTENTED_STREAM}`,
  ACK_PERMISSION_TO_START_PRESENTATION = `${EKeyHeader.CONTENTED_STREAM_STATE}: ${EContentContentedStreamSend.ACK_PERMISSION_TO_START_PRESENTATION}`,
  STOPPED_CLIENT_PRESENTATION = `${EKeyHeader.CONTENTED_STREAM_STATE}: ${EContentContentedStreamSend.STOPPED_CLIENT_PRESENTATION}`,

  ENABLE_MAIN_CAM = `${EKeyHeader.CONTENT_ENABLE_MEDIA_DEVICE}: LETMESTARTMAINCAM`,
}

export enum EContentSyncMediaState {
  ADMIN_SYNC_FORCED = '1',
  ADMIN_SYNC_NOT_FORCED = '0',
}

export enum EContentUseLicense {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  AUDIOPLUSPRESENTATION = 'AUDIOPLUSPRESENTATION',
}

// Маппинг типов для каждого header
type THeaderValueMap = {
  [EKeyHeader.CONTENT_ENTER_ROOM]: string;
  [EKeyHeader.PARTICIPANT_NAME]: string;
  [EKeyHeader.CONTENTED_STREAM_CODEC]: EContentedStreamCodec;
  [EKeyHeader.CONTENT_TYPE]: EContentTypeReceived;
  [EKeyHeader.CONTENT_USE_LICENSE]: EContentUseLicense;
  [EKeyHeader.INPUT_CHANNELS]: string;
  [EKeyHeader.OUTPUT_CHANNELS]: string;
  [EKeyHeader.MAIN_CAM]: EContentMainCAM;
  [EKeyHeader.MIC]: EContentMic;
  [EKeyHeader.MEDIA_SYNC]: EContentSyncMediaState;
  [EKeyHeader.MAIN_CAM_RESOLUTION]: string;
  [EKeyHeader.MEDIA_STATE]: string;
  [EKeyHeader.MEDIA_TYPE]: number;
  [EKeyHeader.MAIN_CAM_STATE]: number;
  [EKeyHeader.MIC_STATE]: number;
  [EKeyHeader.CONTENT_PARTICIPANT_STATE]: EContentParticipantType;
  [EKeyHeader.NOTIFY]: string;
  [EKeyHeader.CONTENT_ENABLE_MEDIA_DEVICE]: string;
  [EKeyHeader.CONTENTED_STREAM_STATE]: EContentedStreamSendAndReceive;
  [EKeyHeader.AVAILABLE_INCOMING_BITRATE]: number;
  [EKeyHeader.AUDIO_TRACK_COUNT]: number;
  [EKeyHeader.VIDEO_TRACK_COUNT]: number;
  [EKeyHeader.TRACKS_DIRECTION]: string;
  [EKeyHeader.AUDIO_ID]: string;
  [EKeyHeader.BEARER_TOKEN]: string | undefined;
  [EKeyHeader.IS_DIRECT_PEER_TO_PEER]: boolean;
};

export type EValueHeader<T extends EKeyHeader> = THeaderValueMap[T];
