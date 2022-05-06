import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import {
  dataForConnectionWithAuthorization,
  dataForConnectionWithoutAuthorization,
} from '../__mocks__';
import { channelsHeaders, channelsData } from '../__mocks__/channelsNotify';
import JsSIP from '../__mocks__/jssip.mock';
import SipConnector from '../SipConnector';

describe('channels notify', () => {
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

  it('wait channels notify event authorized', async () => {
    expect.assertions(1);

    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.on('channels:notify', async (channels) => {
        expect(channels).toEqual(channelsData);

        resolve();
      });

      // @ts-ignore
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

      // @ts-ignore
      JsSIP.triggerNewSipEvent(ua, channelsHeaders);
    });
  });
});
