/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import { dataForConnectionWithAuthorization } from '../__fixtures__';
import JsSIP from '../__fixtures__/jssip.mock';
import {
  webcastStartedData,
  webcastStartedHeaders,
  webcastStoppedData,
  webcastStoppedHeaders,
} from '../__fixtures__/webcastNotify';
import { doMockSipConnector } from '../doMock';

import type { SipConnector } from '../SipConnector';

describe('webcast notify', () => {
  const number = '111';

  let sipConnector: SipConnector;
  let mediaStream: MediaStream;

  beforeEach(() => {
    sipConnector = doMockSipConnector();
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
      sipConnector.on('api:webcast:started', (data) => {
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
      sipConnector.on('api:webcast:stopped', (data) => {
        expect(data).toEqual(webcastStoppedData);

        resolve();
      });

      JsSIP.triggerNewSipEvent(ua, webcastStoppedHeaders);
    });
  });
});
