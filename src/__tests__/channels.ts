import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithAuthorization } from '../__mocks__';
import { channelsHeaders, channelsData, sendedExtraHeaders } from '../__mocks__/channels';
import JsSIP from '../__mocks__/jssip.mock';
import SipConnector from '../SipConnector';
import { CONTENT_TYPE_CHANNELS } from '../headers';

describe('channels', () => {
  const number = '111';

  let sipConnector: SipConnector;
  let mediaStream;
  let mockFn;

  beforeEach(() => {
    sipConnector = createSipConnector();
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });
  });

  it('waitChannels', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = sipConnector.waitChannels();
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, channelsHeaders);
    }

    return promise.then((channels) => {
      expect(channels).toEqual(channelsData);
    });
  });

  it('sendChannels', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    mockFn = jest.fn(() => {
      return undefined;
    });

    // @ts-ignore
    sipConnector.session.sendInfo = mockFn;

    sipConnector.sendChannels(channelsData);

    expect(mockFn).toHaveBeenCalledWith(CONTENT_TYPE_CHANNELS, undefined, sendedExtraHeaders);
  });
});
