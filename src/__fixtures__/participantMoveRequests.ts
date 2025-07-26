import {
  CONTENT_TYPE_NOTIFY,
  CONTENT_TYPE_PARTICIPANT_STATE,
  HEADER_CONTENT_PARTICIPANT_STATE,
  HEADER_CONTENT_TYPE_NAME,
  HEADER_NOTIFY,
} from '../headers';
import { SPECTATOR } from './constants';

const acceptingWordRequest = {
  cmd: 'ParticipationRequestAccepted',
  body: { conference: '111' },
};

export const acceptingWordRequestHeaders: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY],
  [HEADER_NOTIFY, JSON.stringify(acceptingWordRequest)],
];

export const acceptingWordRequestData = {
  conference: acceptingWordRequest.body.conference,
};

const cancellingWordRequest = {
  cmd: 'ParticipationRequestRejected',
  body: { conference: '111' },
};

export const cancellingWordRequestHeaders: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY],
  [HEADER_NOTIFY, JSON.stringify(cancellingWordRequest)],
];

export const cancellingWordRequestData = {
  conference: cancellingWordRequest.body.conference,
};

const moveRequestToStream = {
  cmd: 'ParticipantMovedToWebcast',
  body: { conference: '111' },
};

export const moveRequestToStreamHeaders: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY],
  [HEADER_NOTIFY, JSON.stringify(moveRequestToStream)],
];

export const moveRequestToStreamData = {
  conference: moveRequestToStream.body.conference,
};

export const moveRequestToSpectatorsHeaders: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_PARTICIPANT_STATE],
  [HEADER_CONTENT_PARTICIPANT_STATE, SPECTATOR],
];
