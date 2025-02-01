/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';
import type SipConnector from '../SipConnector';
import {
  dataForConnectionWithAuthorization,
  dataForConnectionWithoutAuthorization,
} from '../__fixtures__';
import { channelsData, channelsHeaders } from '../__fixtures__/channelsNotify';
import JsSIP from '../__fixtures__/jssip.mock';
import { doMockSipConnector } from '../doMock';

describe('channels notify', () => {
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

  it('wait channels notify event authorized', async () => {
    expect.assertions(1);

    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.on('channels:notify', async (channels) => {
        expect(channels).toEqual(channelsData);

        resolve();
      });

      JsSIP.triggerNewSipEvent(ua, channelsHeaders);
    });
  });

  it('wait channels notify event unauthorized', async () => {
    expect.assertions(1);

    const ua = await sipConnector.connect(dataForConnectionWithoutAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.on('channels:notify', async (channels) => {
        expect(channels).toEqual(channelsData);

        resolve();
      });

      JsSIP.triggerNewSipEvent(ua, channelsHeaders);
    });
  });
});
