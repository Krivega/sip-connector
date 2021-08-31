import { HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY, HEADER_NOTIFY } from '../headers';

const moveRequestToConference = {
  cmd: 'WebcastParticipationAccepted',
  conference: '111',
};

export const moveRequestToConferenceHeaders = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY],
  [HEADER_NOTIFY, JSON.stringify(moveRequestToConference)],
];

export const moveRequestToConferenceData = {
  conference: moveRequestToConference.conference,
};

const moveRequestToStream = {
  cmd: 'ParticipantMovedToWebcast',
  conference: '111',
};

export const moveRequestToStreamHeaders = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY],
  [HEADER_NOTIFY, JSON.stringify(moveRequestToStream)],
];

export const moveRequestToStreamData = {
  conference: moveRequestToStream.conference,
};
