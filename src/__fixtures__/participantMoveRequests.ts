import { EContentTypeReceived, EKeyHeader } from '../ApiManager';
import { SPECTATOR } from './constants';

const acceptingWordRequest = {
  cmd: 'ParticipationRequestAccepted',
  body: { conference: '111' },
};

export const acceptingWordRequestHeaders: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.NOTIFY],
  [EKeyHeader.NOTIFY, JSON.stringify(acceptingWordRequest)],
];

export const acceptingWordRequestData = {
  conference: acceptingWordRequest.body.conference,
};

const cancellingWordRequest = {
  cmd: 'ParticipationRequestRejected',
  body: { conference: '111' },
};

export const cancellingWordRequestHeaders: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.NOTIFY],
  [EKeyHeader.NOTIFY, JSON.stringify(cancellingWordRequest)],
];

export const cancellingWordRequestData = {
  conference: cancellingWordRequest.body.conference,
};

const moveRequestToStream = {
  cmd: 'ParticipantMovedToWebcast',
  body: { conference: '111' },
};

export const moveRequestToStreamHeaders: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.NOTIFY],
  [EKeyHeader.NOTIFY, JSON.stringify(moveRequestToStream)],
];

export const moveRequestToStreamData = {
  conference: moveRequestToStream.body.conference,
};

export const moveRequestToSpectatorsHeaders: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.PARTICIPANT_STATE],
  [EKeyHeader.CONTENT_PARTICIPANT_STATE, SPECTATOR],
];
