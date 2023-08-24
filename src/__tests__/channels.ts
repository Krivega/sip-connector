import { createMediaStreamMock } from 'webrtc-mock';
import SipConnector from '../SipConnector';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import { channelsData, channelsHeaders, sendedExtraHeaders } from '../__fixtures__/channels';
import createSipConnector from '../__fixtures__/doMock';
import JsSIP from '../__fixtures__/jssip.mock';
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
    expect.assertions(1);

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
    expect.assertions(1);

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
