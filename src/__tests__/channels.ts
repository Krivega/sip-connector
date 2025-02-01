/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';
import type SipConnector from '../SipConnector';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import { channelsData, channelsHeaders, sendedExtraHeaders } from '../__fixtures__/channels';
import JsSIP from '../__fixtures__/jssip.mock';
import createSipConnector from '../doMock';
import { CONTENT_TYPE_CHANNELS } from '../headers';

describe('channels', () => {
  const number = '111';

  let sipConnector: SipConnector;
  let mediaStream: MediaStream;
  let mockFunction = jest.fn();

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
    const { rtcSession } = sipConnector;

    if (rtcSession) {
      JsSIP.triggerNewInfo(rtcSession, channelsHeaders);
    }

    return promise.then((channels) => {
      expect(channels).toEqual(channelsData);
    });
  });

  it('sendChannels', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    mockFunction = jest.fn(() => {});

    // @ts-expect-error
    sipConnector.rtcSession.sendInfo = mockFunction;

    sipConnector.sendChannels(channelsData);

    expect(mockFunction).toHaveBeenCalledWith(CONTENT_TYPE_CHANNELS, undefined, sendedExtraHeaders);
  });
});
