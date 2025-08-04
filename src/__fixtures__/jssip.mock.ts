import type {
  IncomingInfoEvent,
  IncomingRequest,
  Originator,
  RTCSession,
  UA,
} from '@krivega/jssip';
import NameAddrHeader from '@krivega/jssip/lib/NameAddrHeader';
import URI from '@krivega/jssip/lib/URI';
import { EventEmitter } from 'node:events';
import Request from './Request.mock';
import Session from './RTCSessionMock';
import UAMock from './UA.mock';
import WebSocketInterfaceMock from './WebSocketInterface.mock';

// eslint-disable-next-line unicorn/prefer-event-target
class Info extends EventEmitter {
  public contentType: string;

  public body: string;

  public constructor(contentType: string, body: string) {
    super();
    this.contentType = contentType;
    this.body = body;
  }
}

const originatorRemote: Originator.REMOTE = 'remote' as Originator.REMOTE;

const triggerNewInfo = (rtcSession: RTCSession, extraHeaders: [string, string][]) => {
  const request = new Request(extraHeaders);
  const incomingInfoEvent: IncomingInfoEvent = {
    originator: originatorRemote,
    request: request as IncomingRequest,
    info: new Info('', ''),
  };

  const rtcSessionMock = rtcSession as unknown as Session;

  rtcSessionMock.newInfo(incomingInfoEvent);
};

const triggerNewSipEvent = (ua: UA, extraHeaders: [string, string][]) => {
  const request = new Request(extraHeaders);
  const incomingSipEvent = { event: 'sipEvent', request };
  const uaMock = ua as unknown as UAMock;

  uaMock.newSipEvent(incomingSipEvent);
};

const triggerIncomingSession = (
  ua: UAMock,
  {
    incomingNumber = '1234',
    displayName,
    host,
  }: { incomingNumber?: string; displayName: string; host: string },
) => {
  const session = new Session({ originator: originatorRemote, eventHandlers: {} });
  const uri = new URI('sip', incomingNumber, host);

  session.remote_identity = new NameAddrHeader(uri, displayName);

  const request = new Request([]);

  ua.trigger('newRTCSession', {
    originator: originatorRemote,
    session: session as unknown as RTCSession,
    request,
  });
};

const triggerFailIncomingSession = (
  incomingSession: RTCSession,
  options?: { originator: 'local' | 'remote' },
) => {
  if (options) {
    (incomingSession as unknown as Session).trigger('failed', options);
  } else {
    (incomingSession as unknown as Session).trigger('failed', incomingSession);
  }
};

const jssip = {
  triggerNewInfo,
  triggerNewSipEvent,
  triggerIncomingSession,
  triggerFailIncomingSession,
  WebSocketInterface: WebSocketInterfaceMock,
  UA: UAMock,
  C: {
    INVITE: 'INVITE',
  },
};

export default jssip;

export { NAME_INCORRECT, PASSWORD_CORRECT, PASSWORD_CORRECT_2 } from './UA.mock';

export { FAILED_CONFERENCE_NUMBER } from './RTCSessionMock';
