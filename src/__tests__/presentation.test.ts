/* eslint-disable @typescript-eslint/no-non-null-assertion */
/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import { dataForConnectionWithAuthorization } from '../__fixtures__';
import SessionMock, { createDeclineStartPresentationError } from '../__fixtures__/RTCSessionMock';
import { EContentTypeReceived, EHeader } from '../ApiManager';
import { doMockSipConnector } from '../doMock';

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
    SessionMock.resetStartPresentationError();
  });

  it('twice start presentation', async () => {
    expect.assertions(1);
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });
    await sipConnector.startPresentation(mediaStream);

    return sipConnector.startPresentation(mediaStream).catch((error: unknown) => {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(error).toEqual(new Error('Presentation is already started'));
    });
  });

  it('isPendingPresentation and for start presentation', async () => {
    expect.assertions(7);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = sipConnector.startPresentation(mediaStream);

    expect(sipConnector.presentationManager.isPendingPresentation).toBe(true);
    expect(sipConnector.presentationManager.promisePendingStartPresentation).toBeDefined();
    expect(sipConnector.presentationManager.streamPresentationCurrent).toBeDefined();

    return promise.then(() => {
      expect(sipConnector.presentationManager.isPendingPresentation).toBe(false);
      expect(sipConnector.presentationManager.promisePendingStartPresentation).toBeUndefined();
      expect(sipConnector.presentationManager.promisePendingStopPresentation).toBeUndefined();
      expect(sipConnector.presentationManager.streamPresentationCurrent).toBeDefined();
    });
  });

  it('clear after hungUp for start presentation', async () => {
    expect.assertions(4);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });
    await sipConnector.startPresentation(mediaStream);
    await sipConnector.hangUp();

    expect(sipConnector.presentationManager.isPendingPresentation).toBe(false);
    expect(sipConnector.presentationManager.promisePendingStartPresentation).toBeUndefined();
    expect(sipConnector.presentationManager.promisePendingStopPresentation).toBeUndefined();
    expect(sipConnector.presentationManager.streamPresentationCurrent).toBeUndefined();
  });

  it('isPendingPresentation and promisePendingStopPresentation for stop presentation', async () => {
    expect.assertions(7);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });
    await sipConnector.startPresentation(mediaStream);

    const promise = sipConnector.stopPresentation();

    expect(sipConnector.presentationManager.isPendingPresentation).toBe(true);
    expect(sipConnector.presentationManager.promisePendingStopPresentation).toBeDefined();
    expect(sipConnector.presentationManager.streamPresentationCurrent).toBeDefined();

    return promise.then(() => {
      expect(sipConnector.presentationManager.isPendingPresentation).toBe(false);
      expect(sipConnector.presentationManager.promisePendingStopPresentation).toBeUndefined();
      expect(sipConnector.presentationManager.streamPresentationCurrent).toBeUndefined();
      expect(sipConnector.presentationManager.promisePendingStartPresentation).toBeUndefined();
    });
  });

  it('clear after hungUp for stop presentation', async () => {
    expect.assertions(4);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });
    await sipConnector.startPresentation(mediaStream);
    await sipConnector.stopPresentation();
    await sipConnector.hangUp();

    expect(sipConnector.presentationManager.isPendingPresentation).toBe(false);
    expect(sipConnector.presentationManager.promisePendingStartPresentation).toBeUndefined();
    expect(sipConnector.presentationManager.promisePendingStopPresentation).toBeUndefined();
    expect(sipConnector.presentationManager.streamPresentationCurrent).toBeUndefined();
  });

  it('update presentation after start', async () => {
    expect.assertions(8);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });
    await sipConnector.startPresentation(mediaStream);

    const previousMediaStream = sipConnector.presentationManager.streamPresentationCurrent;

    const promise = sipConnector.updatePresentation(mediaStreamUpdated);

    expect(sipConnector.presentationManager.isPendingPresentation).toBe(true);
    expect(sipConnector.presentationManager.promisePendingStartPresentation).toBeDefined();
    expect(sipConnector.presentationManager.streamPresentationCurrent).toBeDefined();

    return promise.then(() => {
      expect(sipConnector.presentationManager.isPendingPresentation).toBe(false);
      expect(sipConnector.presentationManager.promisePendingStartPresentation).toBeUndefined();
      expect(sipConnector.presentationManager.promisePendingStopPresentation).toBeUndefined();
      expect(sipConnector.presentationManager.streamPresentationCurrent).toBeDefined();
      expect(previousMediaStream).not.toBe(
        sipConnector.presentationManager.streamPresentationCurrent,
      );
    });
  });

  it('update presentation before startPresentation promise resolved', async () => {
    expect.assertions(13);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    sipConnector.startPresentation(mediaStream);

    const previousMediaStream = sipConnector.presentationManager.streamPresentationCurrent;
    const startPresentationPromise =
      sipConnector.presentationManager.promisePendingStartPresentation;

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    sipConnector.updatePresentation(mediaStreamUpdated);

    expect(sipConnector.presentationManager.isPendingPresentation).toBe(true);
    expect(sipConnector.presentationManager.promisePendingStartPresentation).toBeDefined();
    expect(sipConnector.presentationManager.streamPresentationCurrent).toBeDefined();

    return startPresentationPromise
      ?.then(async () => {
        expect(sipConnector.presentationManager.isPendingPresentation).toBe(true);
        expect(previousMediaStream).not.toBe(
          sipConnector.presentationManager.streamPresentationCurrent,
        );
        expect(sipConnector.presentationManager.promisePendingStartPresentation).toBeDefined();
        expect(sipConnector.presentationManager.promisePendingStopPresentation).toBeUndefined();
        expect(sipConnector.presentationManager.streamPresentationCurrent).toBeDefined();

        const updatePresentationPromise =
          sipConnector.presentationManager.promisePendingStartPresentation;

        return updatePresentationPromise;
      })
      .then(() => {
        expect(sipConnector.presentationManager.isPendingPresentation).toBe(false);
        expect(sipConnector.presentationManager.promisePendingStartPresentation).toBeUndefined();
        expect(sipConnector.presentationManager.promisePendingStopPresentation).toBeUndefined();
        expect(sipConnector.presentationManager.streamPresentationCurrent).toBeDefined();
        expect(previousMediaStream).not.toBe(
          sipConnector.presentationManager.streamPresentationCurrent,
        );
      });
  });

  it('update presentation without start', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    return sipConnector.updatePresentation(mediaStreamUpdated).catch((error: unknown) => {
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

    await sipConnector.startPresentation(mediaStream);

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

    await sipConnector.startPresentation(mediaStream);

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

    await sipConnector.startPresentation(mediaStream).catch((error: unknown) => {
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

    SessionMock.setStartPresentationError(declineStartPresentationError);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    // @ts-expect-error
    const sendPresentationMocked = jest.spyOn(sipConnector.presentationManager, 'sendPresentation');
    let stream;

    try {
      stream = await sipConnector.startPresentation(mediaStream);
    } catch (error) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(error).toEqual(new Error('call limit (1) is reached'));
    }

    expect(sendPresentationMocked).toHaveBeenCalledTimes(startPresentationCallLimit);
    expect(stream).toBeUndefined();
  });

  it('should complete start presentation after 2 attempts has failed', async () => {
    expect.assertions(2);

    SessionMock.setStartPresentationError(declineStartPresentationError, {
      count: errorStartPresentationCount,
    });

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    // @ts-expect-error
    const sendPresentationMocked = jest.spyOn(sipConnector.presentationManager, 'sendPresentation');

    const stream = await sipConnector.startPresentation(mediaStream, {
      callLimit: errorStartPresentationCount,
    });

    expect(sendPresentationMocked).toHaveBeenCalledTimes(errorStartPresentationCount);
    expect(stream).toBeInstanceOf(MediaStream);
  });

  // TODO: because of removed cancelable promises, this test is skipped
  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('should cancel requests send presentation after stop presentation', async () => {
    expect.assertions(4);

    SessionMock.setStartPresentationError(declineStartPresentationError);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    // @ts-expect-error
    const sendPresentationMocked = jest.spyOn(sipConnector.presentationManager, 'sendPresentation');
    const cancelSendPresentationWithRepeatedCallsMocked = jest.spyOn(
      sipConnector.presentationManager,
      'cancelSendPresentationWithRepeatedCalls',
    );

    const promiseStartPresentation = sipConnector.startPresentation(mediaStream, {
      callLimit: errorStartPresentationCount,
    });

    try {
      await sipConnector.stopPresentation();
    } catch (error) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(error).toEqual(declineStartPresentationError);
    }

    try {
      await promiseStartPresentation;
    } catch (error) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(error).toEqual(new Error('canceled'));
    }

    expect(sendPresentationMocked).toHaveBeenCalledTimes(1);
    expect(cancelSendPresentationWithRepeatedCallsMocked).toHaveBeenCalledTimes(1);
  });

  // TODO: because of removed cancelable promises, this test is skipped
  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('should cancel requests send presentation after hang up call', async () => {
    expect.assertions(3);

    SessionMock.setStartPresentationError(declineStartPresentationError);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    // @ts-expect-error
    const sendPresentationMocked = jest.spyOn(sipConnector.presentationManager, 'sendPresentation');
    const cancelSendPresentationWithRepeatedCallsMocked = jest.spyOn(
      sipConnector.presentationManager,
      'cancelSendPresentationWithRepeatedCalls',
    );

    const promiseStartPresentation = sipConnector.startPresentation(mediaStream, {
      callLimit: errorStartPresentationCount,
    });

    await sipConnector.hangUp();

    try {
      await promiseStartPresentation;
    } catch (error) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(error).toEqual(new Error('canceled'));
    }

    expect(sendPresentationMocked).toHaveBeenCalledTimes(1);
    expect(cancelSendPresentationWithRepeatedCallsMocked).toHaveBeenCalledTimes(3);
  });
});
