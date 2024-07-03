/// <reference types="jest" />
import type { ExtraHeaders } from '@krivega/jssip';
import { createMediaStreamMock } from 'webrtc-mock';
import type SipConnector from '../SipConnector';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import createSipConnector from '../doMock';
import {
  CONTENT_TYPE_SHARE_STATE,
  HEADER_MUST_STOP_PRESENTATION_P2P,
  HEADER_START_PRESENTATION,
  HEADER_START_PRESENTATION_P2P,
} from '../headers';

describe('presentation', () => {
  const number = '111';
  let sipConnector: SipConnector;
  let mediaStream: MediaStream;
  let mediaStreamUpdated: MediaStream;

  const failedToSendMustStopSendPresentationError = 'failedToSendMustStopSendPresentationError';

  const mockFailToSendMustStopPresentationInfo = () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const actualSendInfo = sipConnector.session!.sendInfo;

    sipConnector.session!.sendInfo = jest.fn(
      async (
        contentType: string,
        body?: string | undefined,
        options?: ExtraHeaders | undefined,
      ) => {
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
    sipConnector = createSipConnector();
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });
    mediaStreamUpdated = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });
  });

  it('twice start presentation', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });
    await sipConnector.startPresentation(mediaStream);

    return sipConnector.startPresentation(mediaStream).catch((error: unknown) => {
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
    expect(sipConnector._streamPresentationCurrent).toBeDefined();

    return promise.then(() => {
      expect(sipConnector.isPendingPresentation).toBe(false);
      expect(sipConnector.promisePendingStartPresentation).toBeUndefined();
      expect(sipConnector.promisePendingStopPresentation).toBeUndefined();
      expect(sipConnector._streamPresentationCurrent).toBeDefined();
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
    expect(sipConnector._streamPresentationCurrent).toBeUndefined();
  });

  it('isPendingPresentation and promisePendingStopPresentation for stop presentation', async () => {
    expect.assertions(7);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });
    await sipConnector.startPresentation(mediaStream);

    const promise = sipConnector.stopPresentation();

    expect(sipConnector.isPendingPresentation).toBe(true);
    expect(sipConnector.promisePendingStopPresentation).toBeDefined();
    expect(sipConnector._streamPresentationCurrent).toBeDefined();

    return promise.then(() => {
      expect(sipConnector.isPendingPresentation).toBe(false);
      expect(sipConnector.promisePendingStopPresentation).toBeUndefined();
      expect(sipConnector._streamPresentationCurrent).toBeUndefined();
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
    expect(sipConnector._streamPresentationCurrent).toBeUndefined();
  });

  it('update presentation after start', async () => {
    expect.assertions(8);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });
    await sipConnector.startPresentation(mediaStream);

    const previousMediaStream = sipConnector._streamPresentationCurrent;

    const promise = sipConnector.updatePresentation(mediaStreamUpdated);

    expect(sipConnector.isPendingPresentation).toBe(true);
    expect(sipConnector.promisePendingStartPresentation).toBeDefined();
    expect(sipConnector._streamPresentationCurrent).toBeDefined();

    return promise.then(() => {
      expect(sipConnector.isPendingPresentation).toBe(false);
      expect(sipConnector.promisePendingStartPresentation).toBeUndefined();
      expect(sipConnector.promisePendingStopPresentation).toBeUndefined();
      expect(sipConnector._streamPresentationCurrent).toBeDefined();
      expect(previousMediaStream).not.toBe(sipConnector._streamPresentationCurrent);
    });
  });

  it('update presentation before startPresentation promise resolved', async () => {
    expect.assertions(13);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    sipConnector.startPresentation(mediaStream);

    const previousMediaStream = sipConnector._streamPresentationCurrent;
    const startPresentationPromise = sipConnector.promisePendingStartPresentation;

    sipConnector.updatePresentation(mediaStreamUpdated);

    expect(sipConnector.isPendingPresentation).toBe(true);
    expect(sipConnector.promisePendingStartPresentation).toBeDefined();
    expect(sipConnector._streamPresentationCurrent).toBeDefined();

    return startPresentationPromise
      ?.then(async () => {
        expect(sipConnector.isPendingPresentation).toBe(true);
        expect(previousMediaStream).not.toBe(sipConnector._streamPresentationCurrent);
        expect(sipConnector.promisePendingStartPresentation).toBeDefined();
        expect(sipConnector.promisePendingStopPresentation).toBeUndefined();
        expect(sipConnector._streamPresentationCurrent).toBeDefined();

        const updatePresentationPromise = sipConnector.promisePendingStartPresentation;

        return updatePresentationPromise;
      })
      .then(() => {
        expect(sipConnector.isPendingPresentation).toBe(false);
        expect(sipConnector.promisePendingStartPresentation).toBeUndefined();
        expect(sipConnector.promisePendingStopPresentation).toBeUndefined();
        expect(sipConnector._streamPresentationCurrent).toBeDefined();
        expect(previousMediaStream).not.toBe(sipConnector._streamPresentationCurrent);
      });
  });

  it('update presentation without start', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    return sipConnector.updatePresentation(mediaStreamUpdated).catch((error: unknown) => {
      expect(error).toEqual(new Error('Presentation has not started yet'));
    });
  });

  it('should be stopped incoming presentation before outgoing presentation started when isP2P is truthy', async () => {
    expect.assertions(3);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const sendInfoMocked = jest.spyOn(sipConnector.session!, 'sendInfo');

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

    const sendInfoMocked = jest.spyOn(sipConnector.session!, 'sendInfo');

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
});
