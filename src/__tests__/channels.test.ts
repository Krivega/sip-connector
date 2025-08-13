/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import { dataForConnectionWithAuthorization } from '../__fixtures__';
import { channelsData, channelsHeaders, sendedExtraHeaders } from '../__fixtures__/channels';
import JsSIP from '../__fixtures__/jssip.mock';
import { EContentTypeSent } from '../ApiManager';
import { doMockSipConnector } from '../doMock';

import type { SipConnector } from '../SipConnector';

describe('channels', () => {
  const number = '111';

  let sipConnector: SipConnector;
  let mediaStream: MediaStream;
  let mockFunction = jest.fn();

  beforeEach(() => {
    sipConnector = doMockSipConnector();
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
    const { establishedRTCSession } = sipConnector.callManager;

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, channelsHeaders);
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

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    sipConnector.callManager.establishedRTCSession!.sendInfo = mockFunction;

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    sipConnector.sendChannels(channelsData);

    expect(mockFunction).toHaveBeenCalledWith(
      EContentTypeSent.CHANNELS,
      undefined,
      sendedExtraHeaders,
    );
  });
});
