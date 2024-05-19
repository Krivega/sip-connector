/// <reference types="jest" />
import type SipConnector from '../../SipConnector';
import JsSIP from '../../__fixtures__/jssip.mock';
import remoteCallerData from '../../__fixtures__/remoteCallerData';
import doMockSIPconnector from '../../doMock';
import dataCall from '../__fixtures__/call';
import { dataForConnectionWithAuthorization } from '../__fixtures__/connectToServer';
import resolveAnswerIncomingCall from '../answerIncomingCall';
import resolveConnectToServer from '../connectToServer';

describe('actionsProgressIncomingCall', () => {
  let sipConnector: SipConnector;
  let connectToServer: ReturnType<typeof resolveConnectToServer>;
  let answerIncomingCall: ReturnType<typeof resolveAnswerIncomingCall>;
  let onBeforeProgressCall: jest.Mock<void>;
  let onSuccessProgressCall: jest.Mock<void>;
  let onFailProgressCall: jest.Mock<void>;
  let onFinishProgressCall: jest.Mock<void>;
  let onEndedCall: jest.Mock<void>;

  beforeEach(() => {
    jest.resetModules();

    onBeforeProgressCall = jest.fn();
    onSuccessProgressCall = jest.fn();
    onFailProgressCall = jest.fn();
    onFinishProgressCall = jest.fn();
    onEndedCall = jest.fn();

    sipConnector = doMockSIPconnector();
    connectToServer = resolveConnectToServer(sipConnector);
    answerIncomingCall = resolveAnswerIncomingCall(sipConnector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('#1 check onBeforeProgressCall, onSuccessProgressCall, onFinishProgressCall', async () => {
    expect.assertions(4);

    await connectToServer(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incomingCall', async () => {
        await answerIncomingCall({
          ...dataCall,
          onBeforeProgressCall,
          onSuccessProgressCall,
          onFailProgressCall,
          onFinishProgressCall,
        });

        expect(onBeforeProgressCall.mock.calls.length).toBe(1);
        expect(onSuccessProgressCall.mock.calls.length).toBe(1);
        expect(onFailProgressCall.mock.calls.length).toBe(0);
        expect(onFinishProgressCall.mock.calls.length).toBe(1);

        resolve();
      });

      // @ts-expect-error
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    });
  });

  it('#2 check onFailProgressCall', async () => {
    expect.assertions(4);

    const mediaStream = {} as MediaStream;

    const dataForFailedCall = { ...dataCall, mediaStream };

    await connectToServer(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incomingCall', async () => {
        try {
          await answerIncomingCall({
            ...dataForFailedCall,
            onBeforeProgressCall,
            onSuccessProgressCall,
            onFailProgressCall,
            onFinishProgressCall,
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.log(error);
        } finally {
          expect(onBeforeProgressCall.mock.calls.length).toBe(1);
          expect(onSuccessProgressCall.mock.calls.length).toBe(0);
          expect(onFailProgressCall.mock.calls.length).toBe(1);
          expect(onFinishProgressCall.mock.calls.length).toBe(1);
        }

        resolve();
      });

      // @ts-expect-error
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    });
  });

  it('#3 check onEndedCall when ended', async () => {
    expect.assertions(1);

    await connectToServer(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incomingCall', async () => {
        await answerIncomingCall({
          ...dataCall,
          onEndedCall,
        });

        // @ts-expect-error
        sipConnector._sessionEvents.trigger('ended', 'error');

        expect(onEndedCall.mock.calls.length).toBe(1);

        resolve();
      });

      // @ts-expect-error
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    });
  });

  it('#4 check onEndedCall when failed', async () => {
    expect.assertions(1);

    await connectToServer(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incomingCall', async () => {
        await answerIncomingCall({
          ...dataCall,
          onEndedCall,
        });

        // @ts-expect-error
        sipConnector._sessionEvents.trigger('failed', 'error');

        expect(onEndedCall.mock.calls.length).toBe(1);

        resolve();
      });

      // @ts-expect-error
      JsSIP.triggerIncomingSession(sipConnector.ua, remoteCallerData);
    });
  });
});
