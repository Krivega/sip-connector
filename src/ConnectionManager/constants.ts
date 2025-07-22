/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */

export enum EEvent {
  // UA members
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  NEW_RTC_SESSION = 'newRTCSession',
  REGISTERED = 'registered',
  UNREGISTERED = 'unregistered',
  REGISTRATION_FAILED = 'registrationFailed',
  NEW_MESSAGE = 'newMessage',
  SIP_EVENT = 'sipEvent',

  // Synthetic members
  CHANNELS = 'channels',
  CHANNELS_NOTIFY = 'channels:notify',
  PARTICIPANT_ADDED_TO_LIST_MODERATORS = 'participant:added-to-list-moderators',
  PARTICIPANT_REMOVED_FROM_LIST_MODERATORS = 'participant:removed-from-list-moderators',
  PARTICIPANT_MOVE_REQUEST_TO_STREAM = 'participant:move-request-to-stream',
  PARTICIPANT_MOVE_REQUEST_TO_SPECTATORS = 'participant:move-request-to-spectators',
  PARTICIPANT_MOVE_REQUEST_TO_PARTICIPANTS = 'participant:move-request-to-participants',
  PARTICIPATION_ACCEPTING_WORD_REQUEST = 'participation:accepting-word-request',
  PARTICIPATION_CANCELLING_WORD_REQUEST = 'participation:cancelling-word-request',
  WEBCAST_STARTED = 'webcast:started',
  WEBCAST_STOPPED = 'webcast:stopped',
  ACCOUNT_CHANGED = 'account:changed',
  ACCOUNT_DELETED = 'account:deleted',
  CONFERENCE_PARTICIPANT_TOKEN_ISSUED = 'conference:participant-token-issued',
}

const SYNTHETIC_EVENT_NAMES = [
  `${EEvent.PARTICIPATION_ACCEPTING_WORD_REQUEST}`,
  `${EEvent.PARTICIPATION_CANCELLING_WORD_REQUEST}`,
  `${EEvent.PARTICIPANT_MOVE_REQUEST_TO_STREAM}`,
  `${EEvent.CHANNELS_NOTIFY}`,
  `${EEvent.CONFERENCE_PARTICIPANT_TOKEN_ISSUED}`,
  `${EEvent.ACCOUNT_CHANGED}`,
  `${EEvent.ACCOUNT_DELETED}`,
  `${EEvent.WEBCAST_STARTED}`,
  `${EEvent.WEBCAST_STOPPED}`,
  `${EEvent.PARTICIPANT_ADDED_TO_LIST_MODERATORS}`,
  `${EEvent.PARTICIPANT_REMOVED_FROM_LIST_MODERATORS}`,
] as const;

export const UA_EVENT_NAMES = [
  `${EEvent.CONNECTING}`,
  `${EEvent.CONNECTED}`,
  `${EEvent.DISCONNECTED}`,
  `${EEvent.NEW_RTC_SESSION}`,
  `${EEvent.REGISTERED}`,
  `${EEvent.UNREGISTERED}`,
  `${EEvent.REGISTRATION_FAILED}`,
  `${EEvent.NEW_MESSAGE}`,
  `${EEvent.SIP_EVENT}`,
] as const;

export const EVENT_NAMES = [...UA_EVENT_NAMES, ...SYNTHETIC_EVENT_NAMES];

export type TEvent = (typeof EVENT_NAMES)[number];
