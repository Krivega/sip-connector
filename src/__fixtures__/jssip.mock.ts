import type { UA } from '@krivega/jssip';
import NameAddrHeader from '@krivega/jssip/lib/NameAddrHeader';
import type RTCSession from '@krivega/jssip/lib/RTCSession';
import type { IncomingInfoEvent, Originator } from '@krivega/jssip/lib/RTCSession';
import URI from '@krivega/jssip/lib/URI';
import { EventEmitter } from 'node:events';
import Request from './Request.mock';
import Session from './Session.mock';
import UAmock from './UA.mock';
import WebSocketInterfaceMock from './WebSocketInterface.mock';

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
  incomingSession: unknown,
  options?: { originator: 'local' | 'remote' },
) => {
  if (options) {
    // @ts-expect-error
    incomingSession.trigger('failed', options);
  } else {
    // @ts-expect-error
    incomingSession.trigger('failed', incomingSession);
  }
};

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

export { NAME_INCORRECT, PASSWORD_CORRECT, PASSWORD_CORRECT_2 } from './UA.mock';

export { FAILED_CONFERENCE_NUMBER } from './Session.mock';
