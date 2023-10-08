import type SipConnector from '../../SipConnector';
import doMockSIPconnector from '../../__fixtures__/doMock';
import JsSIP from '../../__fixtures__/jssip.mock';
import remoteCallerData from '../../__fixtures__/remoteCallerData';
import dataCall, { peerConnectionFromData } from '../__fixtures__/call';
import { dataForConnectionWithAuthorization } from '../__fixtures__/connectToServer';
import parseObject from '../__tests-utils__/parseObject';
import resolveAnswerIncomingCall from '../answerIncomingCall';
import resolveConnectToServer from '../connectToServer';

describe('answerIncomingCall', () => {
  let sipConnector: SipConnector;
  let connectToServer: ReturnType<typeof resolveConnectToServer>;
  let answerIncomingCall: ReturnType<typeof resolveAnswerIncomingCall>;

  beforeEach(() => {
    jest.resetModules();

    sipConnector = doMockSIPconnector();
    connectToServer = resolveConnectToServer(sipConnector);
    answerIncomingCall = resolveAnswerIncomingCall(sipConnector);
  });

  it('#1 check answer', async () => {
    expect.assertions(1);

    await connectToServer(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incomingCall', async () => {
        const peerconnection = await answerIncomingCall(dataCall);

        // @ts-ignore
        expect(parseObject(peerconnection._receivers)).toEqual(
          parseObject(peerConnectionFromData._receivers),
        );

        resolve();
      });

      // @ts-ignore
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    });
  });
});