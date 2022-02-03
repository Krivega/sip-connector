import { HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY, HEADER_NOTIFY } from '../headers';

const conferenceParticipantTokenIssued = {
    cmd: 'ConferenceParticipantTokenIssued',
    body: {
        conference: '111',
        participant: 'SIP\/participant',
        jwt: 'jwt'
    },
};

export const conferenceParticipantTokenIssuedHeaders = [
    [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_NOTIFY],
    [HEADER_NOTIFY, JSON.stringify(conferenceParticipantTokenIssued)],
];

export const conferenceParticipantTokenIssuedData = {
    conference: conferenceParticipantTokenIssued.body.conference,
    participant: conferenceParticipantTokenIssued.body.participant,
    jwt: conferenceParticipantTokenIssued.body.jwt,
};
