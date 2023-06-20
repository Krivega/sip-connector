import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithAuthorization } from '../__mocks__';
import type SipConnector from '../SipConnector';

describe('presentation', () => {
  const number = '111';
  let sipConnector: SipConnector;
  let mediaStream;

  beforeEach(() => {
    sipConnector = createSipConnector();
    mediaStream = createMediaStreamMock({
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
});
