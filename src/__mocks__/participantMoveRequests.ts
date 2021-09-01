import { HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY, HEADER_NOTIFY } from '../headers';

const moveRequestToConference = {
  cmd: 'WebcastParticipationAccepted',
  body: { conference: '111' },
};

export const moveRequestToConferenceHeaders = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY],
  [HEADER_NOTIFY, JSON.stringify(moveRequestToConference)],
];

export const moveRequestToConferenceData = {
  conference: moveRequestToConference.body.conference,
};

const cancelingWordRequest = {
  cmd: 'WebcastParticipationRejected',
  body: { conference: '111' },
};

export const cancelingWordRequestHeaders = [
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

export const moveRequestToStreamHeaders = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY],
  [HEADER_NOTIFY, JSON.stringify(moveRequestToStream)],
];

export const moveRequestToStreamData = {
  conference: moveRequestToStream.body.conference,
};
