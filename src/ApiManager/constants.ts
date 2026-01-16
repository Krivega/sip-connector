/* eslint-disable @typescript-eslint/prefer-literal-enum-member */

export enum EParticipantType {
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

export enum EEventsMainCAM {
  PAUSE_MAIN_CAM = 'PAUSEMAINCAM',
  RESUME_MAIN_CAM = 'RESUMEMAINCAM',
  MAX_MAIN_CAM_RESOLUTION = 'MAXMAINCAMRESOLUTION',
  ADMIN_STOP_MAIN_CAM = 'ADMINSTOPMAINCAM',
  ADMIN_START_MAIN_CAM = 'ADMINSTARTMAINCAM',
}

export enum EEventsMic {
  ADMIN_STOP_MIC = 'ADMINSTOPMIC',
  ADMIN_START_MIC = 'ADMINSTARTMIC',
}

export enum EKeyHeader {
  CONTENT_TYPE = 'content-type',
  CONTENT_ENTER_ROOM = 'x-webrtc-enter-room',
  CONTENT_USE_LICENSE = 'X-WEBRTC-USE-LICENSE',
  PARTICIPANT_NAME = 'X-WEBRTC-PARTICIPANT-NAME',
  INPUT_CHANNELS = 'X-WEBRTC-INPUT-CHANNELS',
  OUTPUT_CHANNELS = 'X-WEBRTC-OUTPUT-CHANNELS',
  MAIN_CAM = 'X-WEBRTC-MAINCAM',
  MIC = 'X-WEBRTC-MIC',
  MEDIA_SYNC = 'X-WEBRTC-SYNC',
  MAIN_CAM_RESOLUTION = 'X-WEBRTC-MAINCAM-RESOLUTION',
  MEDIA_STATE = 'X-WEBRTC-MEDIA-STATE',
  MEDIA_TYPE = 'X-Vinteo-Media-Type',
  MAIN_CAM_STATE = 'X-Vinteo-MainCam-State',
  MIC_STATE = 'X-Vinteo-Mic-State',
  CONTENT_PARTICIPANT_STATE = 'X-WEBRTC-PARTSTATE',
  NOTIFY = 'X-VINTEO-NOTIFY',
  CONTENT_ENABLE_MEDIA_DEVICE = 'X-WEBRTC-REQUEST-ENABLE-MEDIA-DEVICE',
  CONTENT_SHARE_STATE = 'x-webrtc-share-state',
  AVAILABLE_INCOMING_BITRATE = 'X-WEBRTC-AVAILABLE-INCOMING-BITRATE',
  AUDIO_TRACK_COUNT = 'X-WEBRTC-AUDIO-TRACK-COUNT',
  VIDEO_TRACK_COUNT = 'X-WEBRTC-VIDEO-TRACK-COUNT',
  TRACKS_DIRECTION = 'X-WEBRTC-TRACKS-DIRECTION',
  AUDIO_ID = 'X-WEBRTC-AUDIOID',
}

enum EShareStateSend {
  ACK_PERMISSION_TO_START_PRESENTATION = 'LETMESTARTPRESENTATION',
  STOPPED_CLIENT_PRESENTATION = 'STOPPRESENTATION',
}

export enum EShareStateSendAndReceive {
  AVAILABLE_CONTENTED_STREAM = 'YOUCANRECEIVECONTENT',
  NOT_AVAILABLE_CONTENTED_STREAM = 'CONTENTEND',
  MUST_STOP_PRESENTATION = 'YOUMUSTSTOPSENDCONTENT',
}

export enum EHeader {
  AVAILABLE_CONTENTED_STREAM = `${EKeyHeader.CONTENT_SHARE_STATE}: ${EShareStateSendAndReceive.AVAILABLE_CONTENTED_STREAM}`,
  NOT_AVAILABLE_CONTENTED_STREAM = `${EKeyHeader.CONTENT_SHARE_STATE}: ${EShareStateSendAndReceive.NOT_AVAILABLE_CONTENTED_STREAM}`,
  ACK_PERMISSION_TO_START_PRESENTATION = `${EKeyHeader.CONTENT_SHARE_STATE}: ${EShareStateSend.ACK_PERMISSION_TO_START_PRESENTATION}`,
  STOPPED_CLIENT_PRESENTATION = `${EKeyHeader.CONTENT_SHARE_STATE}: ${EShareStateSend.STOPPED_CLIENT_PRESENTATION}`,

  ENABLE_MAIN_CAM = `${EKeyHeader.CONTENT_ENABLE_MEDIA_DEVICE}: LETMESTARTMAINCAM`,
}

export enum EEventsSyncMediaState {
  ADMIN_SYNC_FORCED = '1',
  ADMIN_SYNC_NOT_FORCED = '0',
}

export enum EUseLicense {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  AUDIOPLUSPRESENTATION = 'AUDIOPLUSPRESENTATION',
}
