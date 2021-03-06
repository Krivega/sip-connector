import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithAuthorization } from '../__mocks__';
import {
  webcastStartedHeaders,
  webcastStartedData,
  webcastStoppedHeaders,
  webcastStoppedData,
} from '../__mocks__/webcastNotify';
import JsSIP from '../__mocks__/jssip.mock';
import SipConnector from '../SipConnector';

describe('webcast notify', () => {
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
  it('event webcast:started', async () => {
    expect.assertions(1);

    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.on('webcast:started', (data) => {
        expect(data).toEqual(webcastStartedData);

        resolve();
      });

      JsSIP.triggerNewSipEvent(ua, webcastStartedHeaders);
    });
  });

  it('event webcast:stopped', async () => {
    expect.assertions(1);

    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.on('webcast:stopped', (data) => {
        expect(data).toEqual(webcastStoppedData);

        resolve();
      });

      JsSIP.triggerNewSipEvent(ua, webcastStoppedHeaders);
    });
  });
});
