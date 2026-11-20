/// <reference types="jest" />
import { C as JsSIP_C } from '@krivega/jssip';

import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import hasCanceledCallError from '@/CallManager/hasCanceledCallError';
import { doMockSipConnector } from '@/doMock';
import dataCall, { dataCallPurgatory, peerConnectionFromData } from '@/tools/__fixtures__/call';
import { dataForConnectionWithoutAuthorization } from '@/tools/__fixtures__/connectToServer';
import parseObject from '@/tools/__tests-utils__/parseObject';
import SipConnectorFacade from '../@SipConnectorFacade';

import type { RTCSession } from '@krivega/jssip';

describe('callToServer', () => {
  let sipConnector: ReturnType<typeof doMockSipConnector>;
  let sipConnectorFacade: SipConnectorFacade;

  beforeEach(() => {
    jest.resetModules();

    sipConnector = doMockSipConnector();
    sipConnectorFacade = new SipConnectorFacade(sipConnector);
  });

  it('check call', async () => {
    expect.assertions(3);

    return sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade.callToServer(dataCall);
      })
      .then((peerConnection) => {
        expect(parseObject(peerConnection.getReceivers())).toEqual(
          parseObject(peerConnectionFromData.getReceivers()),
        );
        expect(dataCall.onEnterPurgatory).toHaveBeenCalledTimes(0);
        expect(dataCall.onEnterConference).toHaveBeenCalledTimes(1);
      });
  });

  it('should call correct handler after purgatory call', async () => {
    expect.assertions(2);

    return sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade.callToServer(dataCallPurgatory);
      })
      .then(() => {
        expect(dataCallPurgatory.onEnterPurgatory).toHaveBeenCalledTimes(1);
        expect(dataCallPurgatory.onEnterConference).toHaveBeenCalledTimes(0);
      });
  });

  describe('stale participant disconnect before call', () => {
    const originalFetch = global.fetch;

    // Прошлый звонок вошёл в комнату и оборвался локально: участник остался на сервере.
    const leaveStaleParticipant = () => {
      sipConnector.callManager.events.trigger('start-call', { number: '1000', answer: false });
      sipConnector.apiManager.events.trigger('enter-room', { room: '1000', participantName: 'p1' });
      sipConnector.apiManager.events.trigger('conference:participant-token-issued', {
        jwt: 'token-1',
        conference: '1000',
        participant: 'p1',
      });
      sipConnector.callManager.events.trigger('ended', {
        originator: 'local',
        cause: JsSIP_C.causes.RTP_TIMEOUT,
      } as never);
    };

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should report failed progress and reject when stale participant disconnect fails', async () => {
      const fetchMock = jest.fn(async () => {
        return { ok: false, status: 500 };
      });
      const onFailProgressCall = jest.fn();
      const onSuccessProgressCall = jest.fn();
      const failedListener = jest.fn();

      global.fetch = fetchMock as unknown as typeof fetch;
      await sipConnectorFacade.connectToServer(dataForConnectionWithoutAuthorization);
      sipConnector.callManager.on('failed', failedListener);
      leaveStaleParticipant();

      await expect(
        sipConnectorFacade.callToServer({ ...dataCall, onFailProgressCall, onSuccessProgressCall }),
      ).rejects.toThrow('Stale participant disconnect failed with status 500');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(onFailProgressCall).toHaveBeenCalledTimes(1);
      expect(onSuccessProgressCall).not.toHaveBeenCalled();
      expect(failedListener).toHaveBeenCalledWith(
        expect.objectContaining({ originator: 'local', cause: JsSIP_C.causes.INTERNAL_ERROR }),
      );
    });

    it('should report failed progress and reject when incoming call is answered during stale participant disconnect', async () => {
      const fetchMock = jest.fn(async (_url: string, init: RequestInit) => {
        return new Promise<never>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        });
      });
      const onFailProgressCall = jest.fn();
      const onSuccessProgressCall = jest.fn();
      const failedListener = jest.fn();
      const incomingSession = new RTCSessionMock({ eventHandlers: {}, originator: 'remote' });

      global.fetch = fetchMock as unknown as typeof fetch;
      await sipConnectorFacade.connectToServer(dataForConnectionWithoutAuthorization);
      sipConnector.callManager.on('failed', failedListener);
      jest
        .spyOn(sipConnector.incomingCallManager, 'extractIncomingRTCSession')
        .mockReturnValue(incomingSession as unknown as RTCSession);
      leaveStaleParticipant();

      const call = sipConnectorFacade
        .callToServer({ ...dataCall, onFailProgressCall, onSuccessProgressCall })
        .then(
          () => {
            throw new Error('Expected callToServer to reject');
          },
          (error: unknown) => {
            return error;
          },
        );

      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);

      const answer = sipConnector
        .answerToIncomingCall({ mediaStream: new MediaStream() })
        .catch(() => {});

      expect(hasCanceledCallError(await call)).toBe(true);
      expect(onFailProgressCall).toHaveBeenCalledTimes(1);
      expect(onSuccessProgressCall).not.toHaveBeenCalled();
      expect(failedListener).not.toHaveBeenCalled();

      await sipConnector.callManager.endCall();
      await answer;
    });
  });
});
