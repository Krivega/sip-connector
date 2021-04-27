import type { RTCSession } from '@krivega/jssip/lib/RTCSession';
import WebSocketInterface from './WebSocketInterface.mock';
import UA, { PASSWORD_CORRECT, PASSWORD_CORRECT_2, NAME_INCORRECT } from './UA.mock';
import Session, { FAILED_CONFERENCE_NUMBER } from './Session.mock';
import Request from './Request.mock';

const triggerNewInfo = (session: RTCSession, extraHeaders: string[][]) => {
  const originator = 'remote';
  const request = new Request(extraHeaders);
  const incomingInfoEvent = { originator, request };

  // @ts-ignore
  session.newInfo(incomingInfoEvent);
};

const triggerIncomingSession = (
  ua,
  {
    incomingNumber = '1234',
    displayName,
    host,
  }: { incomingNumber?: string; displayName: string; host: string }
) => {
  const originator = 'remote';
  const session = new Session({ originator });

  //@ts-ignore
  session._remote_identity = { display_name: displayName, uri: { host, user: incomingNumber } };

  ua.trigger('newRTCSession', { originator, session });
};

const triggerFailIncomingSession = (incomingSession) => {
  incomingSession.trigger('failed', incomingSession);
};

export { PASSWORD_CORRECT, PASSWORD_CORRECT_2, NAME_INCORRECT, FAILED_CONFERENCE_NUMBER };

const jssip = {
  WebSocketInterface,
  UA,
  triggerNewInfo,
  triggerIncomingSession,
  triggerFailIncomingSession,
  C: {
    INVITE: 'INVITE',
  },
};

export default jssip;
