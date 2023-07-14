import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithAuthorization } from '../__mocks__';
import type SipConnector from '../SipConnector';

describe('presentation', () => {
  const number = '111';
  let sipConnector: SipConnector;
  let mediaStream;
  let mediaStreamUpdated;

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

    return sipConnector.startPresentation(mediaStream).catch((error) => {
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
      ?.then(() => {
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

    return sipConnector.updatePresentation(mediaStreamUpdated).catch((error) => {
      expect(error).toEqual(new Error('Presentation has not started yet'));
    });
  });
});
