/// <reference types="jest" />
import type SipConnector from '../../SipConnector';
import JsSIP from '../../__fixtures__/jssip.mock';
import remoteCallerData from '../../__fixtures__/remoteCallerData';
import doMockSIPconnector from '../../doMock';
import dataCall, { peerConnectionFromData } from '../../tools/__fixtures__/call';
import { dataForConnectionWithAuthorization } from '../../tools/__fixtures__/connectToServer';
import parseObject from '../../tools/__tests-utils__/parseObject';
import SipConnectorFacade from '../SipConnectorFacade';

describe('answerIncomingCall', () => {
  let sipConnector: SipConnector;
  let sipConnectorFacade: SipConnectorFacade;

  beforeEach(() => {
    jest.resetModules();

    sipConnector = doMockSIPconnector();
    sipConnectorFacade = new SipConnectorFacade(sipConnector);
  });

  it('#1 check answer', async () => {
    expect.assertions(1);

    await sipConnectorFacade.connectToServer(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incomingCall', async () => {
        const peerconnection = await sipConnectorFacade.answerIncomingCall(dataCall);

        // @ts-expect-error
        expect(parseObject(peerconnection._receivers)).toEqual(
          parseObject(peerConnectionFromData._receivers),
        );

        resolve();
      });

      // @ts-expect-error
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    });
  });
});
