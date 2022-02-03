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
import { ESessionSyntheticsEventNames } from '../events';
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

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.onSession(ESessionSyntheticsEventNames.webcastStarted, (data) => {
        expect(data).toEqual(webcastStartedData);

        resolve();
      });

      const { session } = sipConnector;

      if (session) {
        JsSIP.triggerNewInfo(session, webcastStartedHeaders);
      }
    });
  });

  it('event webcast:stopped', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.onSession(ESessionSyntheticsEventNames.webcastStopped, (data) => {
        expect(data).toEqual(webcastStoppedData);

        resolve();
      });

      const { session } = sipConnector;

      if (session) {
        JsSIP.triggerNewInfo(session, webcastStoppedHeaders);
      }
    });
  });
});
