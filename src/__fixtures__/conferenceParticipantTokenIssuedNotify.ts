import { EContentTypeReceived, EHeader } from '../ApiManager';

const conferenceParticipantTokenIssued = {
  cmd: 'ConferenceParticipantTokenIssued',
  body: {
    conference: '111',
    participant: 'SIP/participant',
    jwt: 'jwt',
  },
};

export const conferenceParticipantTokenIssuedHeaders: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.NOTIFY],
  [EHeader.NOTIFY, JSON.stringify(conferenceParticipantTokenIssued)],
];

export const conferenceParticipantTokenIssuedData = {
  conference: conferenceParticipantTokenIssued.body.conference,
  participant: conferenceParticipantTokenIssued.body.participant,
  jwt: conferenceParticipantTokenIssued.body.jwt,
};
