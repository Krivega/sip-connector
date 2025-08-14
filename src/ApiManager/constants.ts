export enum EHeader {
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
  MUST_STOP_PRESENTATION_P2P = 'x-webrtc-share-state: YOUMUSTSTOPSENDCONTENT',
  START_PRESENTATION_P2P = 'x-webrtc-share-state: YOUCANRECEIVECONTENT',
  STOP_PRESENTATION_P2P = 'x-webrtc-share-state: CONTENTEND',
  STOP_PRESENTATION = 'x-webrtc-share-state: STOPPRESENTATION',
  START_PRESENTATION = 'x-webrtc-share-state: LETMESTARTPRESENTATION',
  ENABLE_MAIN_CAM = 'X-WEBRTC-REQUEST-ENABLE-MEDIA-DEVICE: LETMESTARTMAINCAM',
  AVAILABLE_INCOMING_BITRATE = 'X-WEBRTC-AVAILABLE-INCOMING-BITRATE',
}

export enum EShareState {
  AVAILABLE_SECOND_REMOTE_STREAM = 'YOUCANRECEIVECONTENT',
  NOT_AVAILABLE_SECOND_REMOTE_STREAM = 'CONTENTEND',
  MUST_STOP_PRESENTATION = 'YOUMUSTSTOPSENDCONTENT',
}

export enum EParticipantType {
  SPECTATOR = 'SPECTATOR',
  PARTICIPANT = 'PARTICIPANT',
  SPECTATOR_OVER_SFU = 'SPECTATOROVERSFU',
}

export enum EContentTypeReceived {
  ENTER_ROOM = 'application/vinteo.webrtc.roomname',
  MIC = 'application/vinteo.webrtc.mic',
  USE_LICENSE = 'application/vinteo.webrtc.uselic',
  PARTICIPANT_STATE = 'application/vinteo.webrtc.partstate',
  NOTIFY = 'application/vinteo.webrtc.notify',
  SHARE_STATE = 'application/vinteo.webrtc.sharedesktop',
  MAIN_CAM = 'application/vinteo.webrtc.maincam',
}

export enum EContentTypeSent {
  CHANNELS = 'application/vinteo.webrtc.channels',
  MEDIA_STATE = 'application/vinteo.webrtc.mediastate',
  REFUSAL = 'application/vinteo.webrtc.refusal',
  SHARE_STATE = 'application/vinteo.webrtc.sharedesktop',
  MAIN_CAM = 'application/vinteo.webrtc.maincam',
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

export enum EEventsSyncMediaState {
  ADMIN_SYNC_FORCED = '1',
  ADMIN_SYNC_NOT_FORCED = '0',
}

export enum EUseLicense {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  AUDIOPLUSPRESENTATION = 'AUDIOPLUSPRESENTATION',
}
