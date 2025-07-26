/// <reference types="jest" />
import type SipConnector from '../../SipConnector';
import JsSIP from '../../__fixtures__/jssip.mock';
import remoteCallerData from '../../__fixtures__/remoteCallerData';
import { doMockSipConnector } from '../../doMock';
import dataCall, { peerConnectionFromData } from '../../tools/__fixtures__/call';
import { dataForConnectionWithAuthorization } from '../../tools/__fixtures__/connectToServer';
import parseObject from '../../tools/__tests-utils__/parseObject';
import SipConnectorFacade from '../SipConnectorFacade';

describe('answerToIncomingCall', () => {
  let sipConnector: SipConnector;
  let sipConnectorFacade: SipConnectorFacade;

  beforeEach(() => {
    jest.resetModules();

    sipConnector = doMockSipConnector();
    sipConnectorFacade = new SipConnectorFacade(sipConnector);
  });

  it('#1 check answer', async () => {
    expect.assertions(1);

    await sipConnectorFacade.connectToServer(dataForConnectionWithAuthorization);

    const promiseIncomingCall = sipConnector.wait('incoming-call:incomingCall');

    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    JsSIP.triggerIncomingSession(sipConnector.connectionManager.ua!, remoteCallerData);

    await promiseIncomingCall;

    const peerconnection = await sipConnectorFacade.answerToIncomingCall(dataCall);

    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
    expect(parseObject((peerconnection as RTCPeerConnection).getReceivers())).toEqual(
      parseObject(peerConnectionFromData.getReceivers()),
    );
  });
});
