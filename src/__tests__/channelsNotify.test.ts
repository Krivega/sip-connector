/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import {
  dataForConnectionWithAuthorization,
  dataForConnectionWithoutAuthorization,
} from '../__fixtures__';
import { channelsData, channelsHeaders } from '../__fixtures__/channelsNotify';
import JsSIP from '../__fixtures__/jssip.mock';
import { doMockSipConnector } from '../doMock';

import type { SipConnector } from '../SipConnector';

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

    await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve, reject) => {
      sipConnector.on('api:channels:notify', (channels) => {
        expect(channels).toEqual(channelsData);

        resolve();
      });

      const { ua } = sipConnector.connectionManager;

      if (!ua) {
        reject(new Error('UA not initialized'));

        return;
      }

      JsSIP.triggerNewSipEvent(ua, channelsHeaders);
    });
  });

  it('wait channels notify event unauthorized', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithoutAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve, reject) => {
      const { ua } = sipConnector.connectionManager;

      if (!ua) {
        reject(new Error('UA not initialized'));

        return;
      }

      sipConnector.on('api:channels:notify', (channels) => {
        expect(channels).toEqual(channelsData);

        resolve();
      });

      JsSIP.triggerNewSipEvent(ua, channelsHeaders);
    });
  });
});
