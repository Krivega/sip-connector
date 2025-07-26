/* eslint-disable @typescript-eslint/no-misused-promises */
/// <reference types="jest" />
import JsSIP from '../../__fixtures__/jssip.mock';
import remoteCallerData from '../../__fixtures__/remoteCallerData';
import { doMockSipConnector } from '../../doMock';
import type SipConnector from '../../SipConnector';
import dataCall from '../../tools/__fixtures__/call';
import { dataForConnectionWithAuthorization } from '../../tools/__fixtures__/connectToServer';
import SipConnectorFacade from '../SipConnectorFacade';

describe('actionsProgressIncomingCall', () => {
  let sipConnector: SipConnector;
  let sipConnectorFacade: SipConnectorFacade;
  let onBeforeProgressCall: jest.Mock<void>;
  let onSuccessProgressCall: jest.Mock<void>;
  let onFailProgressCall: jest.Mock<void>;
  let onFinishProgressCall: jest.Mock<void>;
  let onEndedCall: jest.Mock<void>;

  beforeEach(() => {
    jest.resetModules();

    onBeforeProgressCall = jest.fn() as jest.Mock<void>;
    onSuccessProgressCall = jest.fn() as jest.Mock<void>;
    onFailProgressCall = jest.fn() as jest.Mock<void>;
    onFinishProgressCall = jest.fn() as jest.Mock<void>;
    onEndedCall = jest.fn() as jest.Mock<void>;

    sipConnector = doMockSipConnector();
    sipConnectorFacade = new SipConnectorFacade(sipConnector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('#1 check onBeforeProgressCall, onSuccessProgressCall, onFinishProgressCall', async () => {
    expect.assertions(4);

    await sipConnectorFacade.connectToServer(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incoming-call:incomingCall', async () => {
        await sipConnectorFacade.answerToIncomingCall({
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
      JsSIP.triggerIncomingSession(sipConnector.connectionManager.ua, remoteCallerData);
    });
  });

  it('#2 check onFailProgressCall', async () => {
    expect.assertions(4);

    const mediaStream = {} as MediaStream;

    const dataForFailedCall = { ...dataCall, mediaStream };

    await sipConnectorFacade.connectToServer(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incoming-call:incomingCall', async () => {
        try {
          await sipConnectorFacade.answerToIncomingCall({
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
      JsSIP.triggerIncomingSession(sipConnector.connectionManager.ua, remoteCallerData);
    });
  });

  it('#3 check onEndedCall when ended', async () => {
    expect.assertions(1);

    await sipConnectorFacade.connectToServer(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incoming-call:incomingCall', async () => {
        await sipConnectorFacade.answerToIncomingCall({
          ...dataCall,
          onEndedCall,
        });

        sipConnector.callManager.events.trigger('ended', 'error');

        expect(onEndedCall.mock.calls.length).toBe(1);

        resolve();
      });

      // @ts-expect-error
      JsSIP.triggerIncomingSession(sipConnector.connectionManager.ua, remoteCallerData);
    });
  });

  it('#4 check onEndedCall when failed', async () => {
    expect.assertions(1);

    await sipConnectorFacade.connectToServer(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('incoming-call:incomingCall', async () => {
        await sipConnectorFacade.answerToIncomingCall({
          ...dataCall,
          onEndedCall,
        });

        sipConnector.callManager.events.trigger('failed', 'error');

        expect(onEndedCall.mock.calls.length).toBe(1);

        resolve();
      });

      // @ts-expect-error
      JsSIP.triggerIncomingSession(sipConnector.connectionManager.ua, remoteCallerData);
    });
  });
});
