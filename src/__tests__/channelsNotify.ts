import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import {
  dataForConnectionWithAuthorization,
  dataForConnectionWithoutAuthorization,
} from '../__mocks__';
import { channelsHeaders, channelsData } from '../__mocks__/channelsNotify';
import JsSIP from '../__mocks__/jssip.mock';
import { ESessionSyntheticsEventNames } from '../events'
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

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.onSession(ESessionSyntheticsEventNames.channelsNotify, async (channels) => {
        expect(channels).toEqual(channelsData);

        resolve();
      });

      const { session } = sipConnector;

      if (session) {
        JsSIP.triggerNewInfo(session, channelsHeaders);
      }
    });
  });

  it('wait channels notify event unauthorized', async () => {
    expect.assertions(1);

    const ua = await sipConnector.connect(dataForConnectionWithoutAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.onSession(ESessionSyntheticsEventNames.channelsNotify, async (channels) => {
        expect(channels).toEqual(channelsData);

        resolve();
      });

      const { session } = sipConnector;

      if (session) {
        // @ts-ignore
        JsSIP.triggerNewSipEvent(ua, channelsHeaders);
      }
    });
  });
});
