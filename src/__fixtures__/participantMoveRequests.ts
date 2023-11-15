import { HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY, HEADER_NOTIFY } from '../headers';

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

const cancelingWordRequest = {
  cmd: 'ParticipationRequestRejected',
  body: { conference: '111' },
};

export const cancelingWordRequestHeaders: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY],
  [HEADER_NOTIFY, JSON.stringify(cancelingWordRequest)],
];

export const cancelingWordRequestData = {
  conference: cancelingWordRequest.body.conference,
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
