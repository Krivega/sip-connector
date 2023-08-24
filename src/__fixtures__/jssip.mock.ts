import { EventEmitter } from 'events';
import type RTCSession from '@krivega/jssip/lib/RTCSession';
import type { IncomingInfoEvent } from '@krivega/jssip/lib/RTCSession';
import { Originator } from '@krivega/jssip/lib/RTCSession';
import NameAddrHeader from '@krivega/jssip/lib/NameAddrHeader';
import URI from '@krivega/jssip/lib/URI';
import type { UA } from '@krivega/jssip';
import WebSocketInterfaceMock from './WebSocketInterface.mock';
import UAmock, { PASSWORD_CORRECT, PASSWORD_CORRECT_2, NAME_INCORRECT } from './UA.mock';
import Session, { FAILED_CONFERENCE_NUMBER } from './Session.mock';
import Request from './Request.mock';

class Info extends EventEmitter {
  contentType: string;
  body: string;

  constructor(contentType: string, body: string) {
    super();
    this.contentType = contentType;
    this.body = body;
  }
}

const originatorRemote: Originator.REMOTE = 'remote' as Originator.REMOTE;

const triggerNewInfo = (session: RTCSession, extraHeaders: [string, string][]) => {
  const request = new Request(extraHeaders);
  const incomingInfoEvent: IncomingInfoEvent = {
    originator: originatorRemote,
    request,
    info: new Info('', ''),
  };

  const sessionMock = session as unknown as Session;

  sessionMock.newInfo(incomingInfoEvent);
};

const triggerNewSipEvent = (ua: UA, extraHeaders: [string, string][]) => {
  const request = new Request(extraHeaders);
  const incomingSipEvent = { request };
  const uaMock = ua as unknown as UAmock;

  uaMock.newSipEvent(incomingSipEvent);
};

const triggerIncomingSession = (
  ua: UAmock,
  {
    incomingNumber = '1234',
    displayName,
    host,
  }: { incomingNumber?: string; displayName: string; host: string },
) => {
  const session = new Session({ originator: originatorRemote });
  const uri = new URI('sip', incomingNumber, host);

  session._remote_identity = new NameAddrHeader(uri, displayName);

  ua.trigger('newRTCSession', { originator: originatorRemote, session });
};

const triggerFailIncomingSession = (
  incomingSession,
  options?: { originator: 'local' | 'remote' },
) => {
  if (!options) {
    incomingSession.trigger('failed', incomingSession);
  } else {
    incomingSession.trigger('failed', options);
  }
};

export { PASSWORD_CORRECT, PASSWORD_CORRECT_2, NAME_INCORRECT, FAILED_CONFERENCE_NUMBER };

const jssip = {
  triggerNewInfo,
  triggerNewSipEvent,
  triggerIncomingSession,
  triggerFailIncomingSession,
  WebSocketInterface: WebSocketInterfaceMock,
  UA: UAmock,
  C: {
    INVITE: 'INVITE',
  },
};

export default jssip;
