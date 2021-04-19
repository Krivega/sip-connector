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

  it('isPendingPresentation for start presentation', async () => {
    expect.assertions(2);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = sipConnector.startPresentation(mediaStream);

    expect(sipConnector.isPendingPresentation).toBe(true);

    return promise.then(() => {
      expect(sipConnector.isPendingPresentation).toBe(false);
    });
  });
  it('isPendingPresentation for stop presentation', async () => {
    expect.assertions(2);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });
    await sipConnector.startPresentation(mediaStream);

    const promise = sipConnector.stopPresentation();

    expect(sipConnector.isPendingPresentation).toBe(true);

    return promise.then(() => {
      expect(sipConnector.isPendingPresentation).toBe(false);
    });
  });
});
