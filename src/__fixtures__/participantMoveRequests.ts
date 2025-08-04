import { EContentTypeReceived, EHeader } from '../ApiManager';
import { SPECTATOR } from './constants';

const acceptingWordRequest = {
  cmd: 'ParticipationRequestAccepted',
  body: { conference: '111' },
};

export const acceptingWordRequestHeaders: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.NOTIFY],
  [EHeader.NOTIFY, JSON.stringify(acceptingWordRequest)],
];

export const acceptingWordRequestData = {
  conference: acceptingWordRequest.body.conference,
};

const cancellingWordRequest = {
  cmd: 'ParticipationRequestRejected',
  body: { conference: '111' },
};

export const cancellingWordRequestHeaders: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.NOTIFY],
  [EHeader.NOTIFY, JSON.stringify(cancellingWordRequest)],
];

export const cancellingWordRequestData = {
  conference: cancellingWordRequest.body.conference,
};

const moveRequestToStream = {
  cmd: 'ParticipantMovedToWebcast',
  body: { conference: '111' },
};

export const moveRequestToStreamHeaders: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.NOTIFY],
  [EHeader.NOTIFY, JSON.stringify(moveRequestToStream)],
];

export const moveRequestToStreamData = {
  conference: moveRequestToStream.body.conference,
};

export const moveRequestToSpectatorsHeaders: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.PARTICIPANT_STATE],
  [EHeader.CONTENT_PARTICIPANT_STATE, SPECTATOR],
];
