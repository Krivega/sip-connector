/* eslint-disable @typescript-eslint/no-non-null-assertion */
/// <reference types="jest" />
import type { ExtraHeaders } from '@krivega/jssip';
import { createMediaStreamMock } from 'webrtc-mock';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import SessionMock, { createDeclineStartPresentationError } from '../__fixtures__/RTCSessionMock';
import { doMockSipConnector } from '../doMock';
import {
  CONTENT_TYPE_SHARE_STATE,
  HEADER_MUST_STOP_PRESENTATION_P2P,
  HEADER_START_PRESENTATION,
  HEADER_START_PRESENTATION_P2P,
} from '../headers';
import type SipConnector from '../SipConnector';

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
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const actualSendInfo = sipConnector.rtcSession!.sendInfo;

    sipConnector.rtcSession!.sendInfo = jest.fn(
      async (contentType: string, body?: string, options?: ExtraHeaders) => {
        if (
          options?.extraHeaders &&
          options.extraHeaders[0] === HEADER_MUST_STOP_PRESENTATION_P2P
        ) {
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

    expect(sipConnector.isPendingPresentation).toBe(true);
    expect(sipConnector.promisePendingStartPresentation).toBeDefined();
    expect(sipConnector.streamPresentationCurrent).toBeDefined();

    return promise.then(() => {
      expect(sipConnector.isPendingPresentation).toBe(false);
      expect(sipConnector.promisePendingStartPresentation).toBeUndefined();
      expect(sipConnector.promisePendingStopPresentation).toBeUndefined();
      expect(sipConnector.streamPresentationCurrent).toBeDefined();
    });
  });

  it('clear after hungUp for start presentation', async () => {
    expect.assertions(4);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });
    await sipConnector.startPresentation(mediaStream);
    await sipConnector.hangUp();

    expect(sipConnector.isPendingPresentation).toBe(false);
    expect(sipConnector.promisePendingStartPresentation).toBeUndefined();
    expect(sipConnector.promisePendingStopPresentation).toBeUndefined();
    expect(sipConnector.streamPresentationCurrent).toBeUndefined();
  });

  it('isPendingPresentation and promisePendingStopPresentation for stop presentation', async () => {
    expect.assertions(7);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });
    await sipConnector.startPresentation(mediaStream);

    const promise = sipConnector.stopPresentation();

    expect(sipConnector.isPendingPresentation).toBe(true);
    expect(sipConnector.promisePendingStopPresentation).toBeDefined();
    expect(sipConnector.streamPresentationCurrent).toBeDefined();

    return promise.then(() => {
      expect(sipConnector.isPendingPresentation).toBe(false);
      expect(sipConnector.promisePendingStopPresentation).toBeUndefined();
      expect(sipConnector.streamPresentationCurrent).toBeUndefined();
      expect(sipConnector.promisePendingStartPresentation).toBeUndefined();
    });
  });

  it('clear after hungUp for stop presentation', async () => {
    expect.assertions(4);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });
    await sipConnector.startPresentation(mediaStream);
    await sipConnector.stopPresentation();
    await sipConnector.hangUp();

    expect(sipConnector.isPendingPresentation).toBe(false);
    expect(sipConnector.promisePendingStartPresentation).toBeUndefined();
    expect(sipConnector.promisePendingStopPresentation).toBeUndefined();
    expect(sipConnector.streamPresentationCurrent).toBeUndefined();
  });

  it('update presentation after start', async () => {
    expect.assertions(8);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });
    await sipConnector.startPresentation(mediaStream);

    const previousMediaStream = sipConnector.streamPresentationCurrent;

    const promise = sipConnector.updatePresentation(mediaStreamUpdated);

    expect(sipConnector.isPendingPresentation).toBe(true);
    expect(sipConnector.promisePendingStartPresentation).toBeDefined();
    expect(sipConnector.streamPresentationCurrent).toBeDefined();

    return promise.then(() => {
      expect(sipConnector.isPendingPresentation).toBe(false);
      expect(sipConnector.promisePendingStartPresentation).toBeUndefined();
      expect(sipConnector.promisePendingStopPresentation).toBeUndefined();
      expect(sipConnector.streamPresentationCurrent).toBeDefined();
      expect(previousMediaStream).not.toBe(sipConnector.streamPresentationCurrent);
    });
  });

  it('update presentation before startPresentation promise resolved', async () => {
    expect.assertions(13);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    sipConnector.startPresentation(mediaStream);

    const previousMediaStream = sipConnector.streamPresentationCurrent;
    const startPresentationPromise = sipConnector.promisePendingStartPresentation;

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    sipConnector.updatePresentation(mediaStreamUpdated);

    expect(sipConnector.isPendingPresentation).toBe(true);
    expect(sipConnector.promisePendingStartPresentation).toBeDefined();
    expect(sipConnector.streamPresentationCurrent).toBeDefined();

    return startPresentationPromise
      ?.then(async () => {
        expect(sipConnector.isPendingPresentation).toBe(true);
        expect(previousMediaStream).not.toBe(sipConnector.streamPresentationCurrent);
        expect(sipConnector.promisePendingStartPresentation).toBeDefined();
        expect(sipConnector.promisePendingStopPresentation).toBeUndefined();
        expect(sipConnector.streamPresentationCurrent).toBeDefined();

        const updatePresentationPromise = sipConnector.promisePendingStartPresentation;

        return updatePresentationPromise;
      })
      .then(() => {
        expect(sipConnector.isPendingPresentation).toBe(false);
        expect(sipConnector.promisePendingStartPresentation).toBeUndefined();
        expect(sipConnector.promisePendingStopPresentation).toBeUndefined();
        expect(sipConnector.streamPresentationCurrent).toBeDefined();
        expect(previousMediaStream).not.toBe(sipConnector.streamPresentationCurrent);
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

  it('should be stopped incoming presentation before outgoing presentation started when isP2P is truthy', async () => {
    expect.assertions(3);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const sendInfoMocked = jest.spyOn(sipConnector.rtcSession!, 'sendInfo');

    await sipConnector.startPresentation(mediaStream, { isP2P: true });

    expect(sendInfoMocked).toHaveBeenCalledTimes(2);
    expect(sendInfoMocked).toHaveBeenNthCalledWith(1, CONTENT_TYPE_SHARE_STATE, undefined, {
      extraHeaders: [HEADER_MUST_STOP_PRESENTATION_P2P],
    });
    expect(sendInfoMocked).toHaveBeenNthCalledWith(2, CONTENT_TYPE_SHARE_STATE, undefined, {
      extraHeaders: [HEADER_START_PRESENTATION_P2P],
    });
  });

  it('should be stopped incoming presentation before outgoing presentation started when isP2P is falsy', async () => {
    expect.assertions(2);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const sendInfoMocked = jest.spyOn(sipConnector.rtcSession!, 'sendInfo');

    await sipConnector.startPresentation(mediaStream, { isP2P: false });

    expect(sendInfoMocked).toHaveBeenCalledTimes(1);
    expect(sendInfoMocked).toHaveBeenNthCalledWith(1, CONTENT_TYPE_SHARE_STATE, undefined, {
      extraHeaders: [HEADER_START_PRESENTATION],
    });
  });

  it('should be failed presentation when sending HEADER_MUST_STOP_PRESENTATION_P2P info fails', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    mockFailToSendMustStopPresentationInfo();

    let rejectedError = new Error('rejectedError');

    await sipConnector.startPresentation(mediaStream, { isP2P: true }).catch((error: unknown) => {
      rejectedError = error as Error;
    });

    expect(rejectedError.message).toBe(failedToSendMustStopSendPresentationError);
  });

  it('should not repeat start presentation when presentation fails with error, when call limit is not passed', async () => {
    expect.assertions(3);

    SessionMock.setStartPresentationError(declineStartPresentationError);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    // @ts-expect-error
    const sendPresentationMocked = jest.spyOn(sipConnector, 'sendPresentation');
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
    const sendPresentationMocked = jest.spyOn(sipConnector, 'sendPresentation');

    const stream = await sipConnector.startPresentation(mediaStream, undefined, {
      callLimit: errorStartPresentationCount,
    });

    expect(sendPresentationMocked).toHaveBeenCalledTimes(errorStartPresentationCount);
    expect(stream).toBeInstanceOf(MediaStream);
  });

  it('should cancel requests send presentation after stop presentation', async () => {
    expect.assertions(4);

    SessionMock.setStartPresentationError(declineStartPresentationError);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    // @ts-expect-error
    const sendPresentationMocked = jest.spyOn(sipConnector, 'sendPresentation');
    const cancelSendPresentationWithRepeatedCallsMocked = jest.spyOn(
      sipConnector,
      'cancelSendPresentationWithRepeatedCalls',
    );

    const promiseStartPresentation = sipConnector.startPresentation(mediaStream, undefined, {
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

  it('should cancel requests send presentation after hang up call', async () => {
    expect.assertions(3);

    SessionMock.setStartPresentationError(declineStartPresentationError);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    // @ts-expect-error
    const sendPresentationMocked = jest.spyOn(sipConnector, 'sendPresentation');
    const cancelSendPresentationWithRepeatedCallsMocked = jest.spyOn(
      sipConnector,
      'cancelSendPresentationWithRepeatedCalls',
    );

    const promiseStartPresentation = sipConnector.startPresentation(mediaStream, undefined, {
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
