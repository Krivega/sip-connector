import {
  INCOMING_CALL,
  DECLINED_INCOMING_CALL,
  TERMINATED_INCOMING_CALL,
  FAILED_INCOMING_CALL,
  CONNECTING,
  CONNECTED,
  DISCONNECTED,
  NEW_RTC_SESSION,
  REGISTERED,
  UNREGISTERED,
  REGISTRATION_FAILED,
  NEW_MESSAGE,
  SIP_EVENT,
  AVAILABLE_SECOND_REMOTE_STREAM_EVENT,
  NOT_AVAILABLE_SECOND_REMOTE_STREAM_EVENT,
  MUST_STOP_PRESENTATION_EVENT,
  SHARE_STATE,
  ENTER_ROOM,
  USE_LICENSE,
  PEER_CONNECTION_CONFIRMED,
  PEER_CONNECTION_ONTRACK,
  CHANNELS,
  CHANNELS_NOTIFY,
  ENDED_FROM_SERVER,
  MAIN_CAM_CONTROL,
  ADMIN_START_MAIN_CAM,
  ADMIN_STOP_MAIN_CAM,
  ADMIN_STOP_MIC,
  ADMIN_START_MIC,
  ADMIN_FORCE_SYNC_MEDIA_STATE,
  PARTICIPANT_ADDED_TO_LIST_MODERATORS,
  PARTICIPANT_REMOVED_FROM_LIST_MODERATORS,
  PARTICIPATION_ACCEPTING_WORD_REQUEST,
  PARTICIPATION_CANCELLING_WORD_REQUEST,
  PARTICIPANT_MOVE_REQUEST_TO_STREAM,
  WEBCAST_STARTED,
  WEBCAST_STOPPED,
  ACCOUNT_CHANGED,
  ACCOUNT_DELETED,
  CONFERENCE_PARTICIPANT_TOKEN_ISSUED,
  ENDED,
  SENDING,
  REINVITE,
  REPLACES,
  REFER,
  PROGRESS,
  ACCEPTED,
  CONFIRMED,
  PEER_CONNECTION,
  FAILED,
  MUTED,
  UNMUTED,
  NEW_DTMF,
  NEW_INFO,
  HOLD,
  UNHOLD,
  UPDATE,
  SDP,
  ICE_CANDIDATE,
  GET_USER_MEDIA_FAILED,
  PEER_CONNECTION_CREATE_OFFER_FAILED,
  PEER_CONNECTION_CREATE_ANSWER_FAILED,
  PEER_CONNECTION_SET_LOCAL_DESCRIPTION_FAILED,
  PEER_CONNECTION_SET_REMOTE_DESCRIPTION_FAILED,
  PRESENTATION_START,
  PRESENTATION_STARTED,
  PRESENTATION_END,
  PRESENTATION_ENDED,
  PRESENTATION_FAILED,
  PARTICIPANT_STATE,
  PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS,
} from './constants';

export const UA_SYNTHETICS_EVENT_NAMES = [
  INCOMING_CALL,
  DECLINED_INCOMING_CALL,
  TERMINATED_INCOMING_CALL,
  FAILED_INCOMING_CALL,
  PARTICIPATION_ACCEPTING_WORD_REQUEST,
  PARTICIPATION_CANCELLING_WORD_REQUEST,
  PARTICIPANT_MOVE_REQUEST_TO_STREAM,
  CHANNELS_NOTIFY,
  CONFERENCE_PARTICIPANT_TOKEN_ISSUED,
  ACCOUNT_CHANGED,
  ACCOUNT_DELETED,
  WEBCAST_STARTED,
  WEBCAST_STOPPED,
  PARTICIPANT_ADDED_TO_LIST_MODERATORS,
  PARTICIPANT_REMOVED_FROM_LIST_MODERATORS,
] as const;

export const UA_JSSIP_EVENT_NAMES = [
  CONNECTING,
  CONNECTED,
  DISCONNECTED,
  NEW_RTC_SESSION,
  REGISTERED,
  UNREGISTERED,
  REGISTRATION_FAILED,
  NEW_MESSAGE,
  SIP_EVENT,
] as const;

export const SESSION_SYNTHETICS_EVENT_NAMES = [
  AVAILABLE_SECOND_REMOTE_STREAM_EVENT,
  NOT_AVAILABLE_SECOND_REMOTE_STREAM_EVENT,
  MUST_STOP_PRESENTATION_EVENT,
  SHARE_STATE,
  ENTER_ROOM,
  USE_LICENSE,
  PEER_CONNECTION_CONFIRMED,
  PEER_CONNECTION_ONTRACK,
  CHANNELS,
  ENDED_FROM_SERVER,
  MAIN_CAM_CONTROL,
  ADMIN_START_MAIN_CAM,
  ADMIN_STOP_MAIN_CAM,
  ADMIN_STOP_MIC,
  ADMIN_START_MIC,
  ADMIN_FORCE_SYNC_MEDIA_STATE,
  PARTICIPANT_STATE,
  PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS,
] as const;

export const SESSION_JSSIP_EVENT_NAMES = [
  ENDED,
  CONNECTING,
  SENDING,
  REINVITE,
  REPLACES,
  REFER,
  PROGRESS,
  ACCEPTED,
  CONFIRMED,
  PEER_CONNECTION,
  FAILED,
  MUTED,
  UNMUTED,
  NEW_DTMF,
  NEW_INFO,
  HOLD,
  UNHOLD,
  UPDATE,
  SDP,
  ICE_CANDIDATE,
  GET_USER_MEDIA_FAILED,
  PEER_CONNECTION_CREATE_OFFER_FAILED,
  PEER_CONNECTION_CREATE_ANSWER_FAILED,
  PEER_CONNECTION_SET_LOCAL_DESCRIPTION_FAILED,
  PEER_CONNECTION_SET_REMOTE_DESCRIPTION_FAILED,
  PRESENTATION_START,
  PRESENTATION_STARTED,
  PRESENTATION_END,
  PRESENTATION_ENDED,
  PRESENTATION_FAILED,
] as const;

export const UA_EVENT_NAMES = [...UA_JSSIP_EVENT_NAMES, ...UA_SYNTHETICS_EVENT_NAMES];

export const SESSION_EVENT_NAMES = [
  ...SESSION_JSSIP_EVENT_NAMES,
  ...SESSION_SYNTHETICS_EVENT_NAMES,
] as const;

export type TEventUA = (typeof UA_EVENT_NAMES)[number];

export type TEventSession = (typeof SESSION_EVENT_NAMES)[number];
