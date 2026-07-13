/* eslint-disable @typescript-eslint/no-non-null-assertion */
/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import { dataForConnectionWithAuthorization } from '../__fixtures__';
import { createDeclineStartPresentationError } from '../__fixtures__/RTCSessionMock';
import { EContentTypeReceived, EHeader } from '../ApiManager';
import { doMockSipConnector } from '../doMock';
import { PresentationLifecycle } from '../PresentationManager/orchestration/PresentationLifecycle';

import type { ExtraHeaders } from '@krivega/jssip';
import type { SipConnector } from '../SipConnector';

const startPresentationCallLimit = 1;
const errorStartPresentationCount = 3;

describe('presentation', () => {
  const number = '111';
  let sipConnector: SipConnector;
  let mediaStream: MediaStream;
  let mediaStreamUpdated: MediaStream;

  const failedToSendMustStopSendPresentationError = 'failedToSendMustStopSendPresentationError';
  const declineStartPresentationError = createDeclineStartPresentationError();

  const mockRenegotiateFailures = (
    error: Error,
    { successAfterAttempts = Number.POSITIVE_INFINITY }: { successAfterAttempts?: number } = {},
  ) => {
    let attempts = 0;

    sipConnector.callManager.renegotiate = jest.fn(async () => {
      attempts += 1;

      if (attempts < successAfterAttempts) {
        throw error;
      }

      return true;
    });
  };

  const mockRenegotiatePending = () => {
    sipConnector.callManager.renegotiate = jest.fn(async () => {
      return new Promise<boolean>(() => {});
    });
  };

  const mockFailToSendMustStopPresentationInfo = () => {
    const actualSendInfo = sipConnector.callManager.getEstablishedRTCSession()!.sendInfo;

    sipConnector.callManager.getEstablishedRTCSession()!.sendInfo = jest.fn(
      async (contentType: string, body?: string, options?: ExtraHeaders) => {
        if (options?.extraHeaders?.[0] === EHeader.ACK_PERMISSION_TO_START_PRESENTATION) {
          throw new Error(failedToSendMustStopSendPresentationError);
        }

        return actualSendInfo(contentType, body, options);
      },
    );
  };

  beforeEach(() => {
    sipConnector = doMockSipConnector();
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });
    mediaStreamUpdated = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('twice start presentation', async () => {
    expect.assertions(1);
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });
    await sipConnector.startPresentation(mediaStream.getVideoTracks()[0] as MediaStreamVideoTrack);

    return sipConnector
      .startPresentation(mediaStream.getVideoTracks()[0] as MediaStreamVideoTrack)
      .catch((error: unknown) => {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(error).toEqual(new Error('Presentation is already started'));
      });
  });

  it('isPendingPresentation and for start presentation', async () => {
    expect.assertions(4);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = sipConnector.startPresentation(
      mediaStream.getVideoTracks()[0] as MediaStreamVideoTrack,
    );

    expect(sipConnector.presentationManager.isPendingPresentation).toBe(true);

    return promise.then(() => {
      expect(sipConnector.presentationManager.isPendingPresentation).toBe(false);
      expect(sipConnector.presentationManager.stateMachine.isActive).toBe(true);
      expect(sipConnector.presentationManager.stateMachine.activeVideoTrack).toBeDefined();
    });
  });

  it('clear after hungUp for start presentation', async () => {
    expect.assertions(3);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });
    await sipConnector.startPresentation(mediaStream.getVideoTracks()[0] as MediaStreamVideoTrack);
    await sipConnector.hangUp();

    expect(sipConnector.presentationManager.isPendingPresentation).toBe(false);
    expect(sipConnector.presentationManager.stateMachine.isIdle).toBe(true);
    expect(sipConnector.presentationManager.stateMachine.activeVideoTrack).toBeUndefined();
  });

  it('isPendingPresentation and promisePendingStopPresentation for stop presentation', async () => {
    expect.assertions(3);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });
    await sipConnector.startPresentation(mediaStream.getVideoTracks()[0] as MediaStreamVideoTrack);

    const promise = sipConnector.stopPresentation();

    expect(sipConnector.presentationManager.isPendingPresentation).toBe(true);

    return promise.then(() => {
      expect(sipConnector.presentationManager.isPendingPresentation).toBe(false);
      expect(sipConnector.presentationManager.stateMachine.activeVideoTrack).toBeUndefined();
    });
  });

  it('clear after hungUp for stop presentation', async () => {
    expect.assertions(3);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });
    await sipConnector.startPresentation(mediaStream.getVideoTracks()[0] as MediaStreamVideoTrack);
    await sipConnector.stopPresentation();
    await sipConnector.hangUp();

    expect(sipConnector.presentationManager.isPendingPresentation).toBe(false);
    expect(sipConnector.presentationManager.stateMachine.isIdle).toBe(true);
    expect(sipConnector.presentationManager.stateMachine.activeVideoTrack).toBeUndefined();
  });

  it('update presentation after start', async () => {
    expect.assertions(5);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });
    await sipConnector.startPresentation(mediaStream.getVideoTracks()[0] as MediaStreamVideoTrack);

    const previousVideoTrack = sipConnector.presentationManager.stateMachine.activeVideoTrack;

    const promise = sipConnector.updatePresentation(
      mediaStreamUpdated.getVideoTracks()[0] as MediaStreamVideoTrack,
    );

    expect(sipConnector.presentationManager.stateMachine.isActive).toBe(true);

    return promise.then(() => {
      expect(sipConnector.presentationManager.isPendingPresentation).toBe(false);
      expect(sipConnector.presentationManager.stateMachine.activeVideoTrack).toBeDefined();
      expect(previousVideoTrack).not.toBe(
        sipConnector.presentationManager.stateMachine.activeVideoTrack,
      );
      expect(sipConnector.presentationManager.stateMachine.isActive).toBe(true);
    });
  });

  it('update presentation before startPresentation promise resolved', async () => {
    expect.assertions(5);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const startPromise = sipConnector.startPresentation(
      mediaStream.getVideoTracks()[0] as MediaStreamVideoTrack,
    );

    const previousVideoTrack = sipConnector.presentationManager.stateMachine.pendingVideoTrack;

    const updatePromise = sipConnector.updatePresentation(
      mediaStreamUpdated.getVideoTracks()[0] as MediaStreamVideoTrack,
    );

    expect(sipConnector.presentationManager.isPendingPresentation).toBe(true);

    return Promise.all([startPromise, updatePromise]).then(() => {
      expect(sipConnector.presentationManager.isPendingPresentation).toBe(false);
      expect(sipConnector.presentationManager.stateMachine.activeVideoTrack).toBeDefined();
      expect(previousVideoTrack).not.toBe(
        sipConnector.presentationManager.stateMachine.activeVideoTrack,
      );
      expect(sipConnector.presentationManager.stateMachine.isActive).toBe(true);
    });
  });

  it('update presentation without start', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    return sipConnector
      .updatePresentation(mediaStreamUpdated.getVideoTracks()[0] as MediaStreamVideoTrack)
      .catch((error: unknown) => {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(error).toEqual(new Error('Presentation has not started yet'));
      });
  });

  it('should be stopped incoming presentation before outgoing presentation started when in DIRECT_P2P_ROOM', async () => {
    expect.assertions(2);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });
    sipConnector.apiManager.events.trigger('enter-room', {
      room: 'directP2P111to200',
      participantName: 'User',
      isDirectPeerToPeer: true,
    });

    const sendInfoMocked = jest.spyOn(
      sipConnector.callManager.getEstablishedRTCSession()!,
      'sendInfo',
    );

    await sipConnector.startPresentation(mediaStream.getVideoTracks()[0] as MediaStreamVideoTrack);

    expect(sendInfoMocked).toHaveBeenCalledTimes(1);
    expect(sendInfoMocked).toHaveBeenNthCalledWith(1, EContentTypeReceived.SHARE_STATE, undefined, {
      extraHeaders: [EHeader.AVAILABLE_CONTENTED_STREAM],
    });
  });

  it('should be stopped incoming presentation before outgoing presentation started when not in DIRECT_P2P_ROOM', async () => {
    expect.assertions(2);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });
    sipConnector.apiManager.events.trigger('enter-room', {
      room: 'room-1',
      participantName: 'User',
      bearerToken: 'token',
    });

    const sendInfoMocked = jest.spyOn(
      sipConnector.callManager.getEstablishedRTCSession()!,
      'sendInfo',
    );

    await sipConnector.startPresentation(mediaStream.getVideoTracks()[0] as MediaStreamVideoTrack);

    expect(sendInfoMocked).toHaveBeenCalledTimes(1);
    expect(sendInfoMocked).toHaveBeenNthCalledWith(1, EContentTypeReceived.SHARE_STATE, undefined, {
      extraHeaders: [EHeader.ACK_PERMISSION_TO_START_PRESENTATION],
    });
  });

  it('should be failed presentation when sending ACK_PERMISSION_TO_START_PRESENTATION info fails', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });
    sipConnector.apiManager.events.trigger('enter-room', {
      room: 'room-1',
      participantName: 'User',
      bearerToken: 'token',
    });

    mockFailToSendMustStopPresentationInfo();

    let rejectedError = new Error('rejectedError');

    await sipConnector
      .startPresentation(mediaStream.getVideoTracks()[0] as MediaStreamVideoTrack)
      .catch((error: unknown) => {
        rejectedError = error as Error;
      });

    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(rejectedError.values?.lastResult.message).toBe(
      failedToSendMustStopSendPresentationError,
    );
  });

  it('should not repeat start presentation when presentation fails with error, when call limit is not passed', async () => {
    expect.assertions(3);

    mockRenegotiateFailures(declineStartPresentationError);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const executeStartFlowMocked = jest.spyOn(PresentationLifecycle.prototype, 'executeStartFlow');
    let stream;

    try {
      stream = await sipConnector.startPresentation(
        mediaStream.getVideoTracks()[0] as MediaStreamVideoTrack,
      );
    } catch (error) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(error).toEqual(new Error('call limit (1) is reached'));
    }

    expect(executeStartFlowMocked).toHaveBeenCalledTimes(startPresentationCallLimit);
    expect(stream).toBeUndefined();
  });

  it('should complete start presentation after 2 attempts has failed', async () => {
    expect.assertions(2);

    mockRenegotiateFailures(declineStartPresentationError, {
      successAfterAttempts: errorStartPresentationCount,
    });

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const executeStartFlowMocked = jest.spyOn(PresentationLifecycle.prototype, 'executeStartFlow');

    const stream = await sipConnector.startPresentation(
      mediaStream.getVideoTracks()[0] as MediaStreamVideoTrack,
      {
        callLimit: errorStartPresentationCount,
      },
    );

    expect(executeStartFlowMocked).toHaveBeenCalledTimes(errorStartPresentationCount);
    expect(stream).toBe(mediaStream.getVideoTracks()[0]);
  });

  it('should cancel requests send presentation after hang up call', async () => {
    expect.assertions(3);

    mockRenegotiatePending();

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const executeStartFlowMocked = jest.spyOn(PresentationLifecycle.prototype, 'executeStartFlow');
    const cancelSendPresentationWithRepeatedCallsMocked = jest.spyOn(
      sipConnector.presentationManager,
      'cancelSendPresentationWithRepeatedCalls',
    );

    const promiseStartPresentation = sipConnector.startPresentation(
      mediaStream.getVideoTracks()[0] as MediaStreamVideoTrack,
      {
        callLimit: errorStartPresentationCount,
      },
    );

    await sipConnector.hangUp();

    try {
      await promiseStartPresentation;
    } catch (error) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(error).toEqual(new Error('canceled'));
    }

    expect(executeStartFlowMocked).toHaveBeenCalledTimes(1);
    expect(cancelSendPresentationWithRepeatedCallsMocked).toHaveBeenCalledTimes(1);
  });
});
