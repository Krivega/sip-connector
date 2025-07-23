export enum ECMDNotify {
  CHANNELS = 'channels',
  WEBCAST_STARTED = 'WebcastStarted',
  WEBCAST_STOPPED = 'WebcastStopped',
  ACCOUNT_CHANGED = 'accountChanged',
  ACCOUNT_DELETED = 'accountDeleted',
  ADDED_TO_LIST_MODERATORS = 'addedToListModerators',
  REMOVED_FROM_LIST_MODERATORS = 'removedFromListModerators',
  ACCEPTING_WORD_REQUEST = 'ParticipationRequestAccepted',
  CANCELLING_WORD_REQUEST = 'ParticipationRequestRejected',
  MOVE_REQUEST_TO_STREAM = 'ParticipantMovedToWebcast',
  CONFERENCE_PARTICIPANT_TOKEN_ISSUED = 'ConferenceParticipantTokenIssued',
}

export type TChannels = {
  inputChannels: string;
  outputChannels: string;
};

export type TParametersModeratorsList = {
  conference: string;
};

export type TParametersWebcast = {
  conference: string;
  type: string;
};

export type TParametersConferenceParticipantTokenIssued = {
  conference: string;
  participant: string;
  jwt: string;
};

export type TAddedToListModeratorsInfoNotify = {
  cmd: ECMDNotify.ADDED_TO_LIST_MODERATORS;
  conference: string;
};

export type TRemovedFromListModeratorsInfoNotify = {
  cmd: ECMDNotify.REMOVED_FROM_LIST_MODERATORS;
  conference: string;
};

export type TAcceptingWordRequestInfoNotify = {
  cmd: ECMDNotify.ACCEPTING_WORD_REQUEST;
  body: { conference: string };
};

export type TCancellingWordRequestInfoNotify = {
  cmd: ECMDNotify.CANCELLING_WORD_REQUEST;
  body: { conference: string };
};

export type TMoveRequestToStreamInfoNotify = {
  cmd: ECMDNotify.MOVE_REQUEST_TO_STREAM;
  body: { conference: string };
};

export type TConferenceParticipantTokenIssued = {
  cmd: ECMDNotify.CONFERENCE_PARTICIPANT_TOKEN_ISSUED;
  body: { conference: string; participant: string; jwt: string };
};

export type TWebcastInfoNotify = {
  cmd: ECMDNotify.WEBCAST_STARTED;
  body: { conference: string; type: string };
};

export type TWebcastStoppedInfoNotify = {
  cmd: ECMDNotify.WEBCAST_STOPPED;
  body: { conference: string; type: string };
};

export type TChannelsInfoNotify = {
  cmd: ECMDNotify.CHANNELS;
  input: string;
  output: string;
};

export type TAccountChangedInfoNotify = {
  cmd: ECMDNotify.ACCOUNT_CHANGED;
};

export type TAccountDeletedInfoNotify = {
  cmd: ECMDNotify.ACCOUNT_DELETED;
};

export type TInfoNotify =
  | TAddedToListModeratorsInfoNotify
  | TChannelsInfoNotify
  | TRemovedFromListModeratorsInfoNotify
  | TWebcastInfoNotify
  | TConferenceParticipantTokenIssued
  | TAcceptingWordRequestInfoNotify
  | TCancellingWordRequestInfoNotify
  | TMoveRequestToStreamInfoNotify
  | TAccountChangedInfoNotify
  | TAccountDeletedInfoNotify
  | TWebcastStoppedInfoNotify;
