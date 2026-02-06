/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import { dataForConnectionWithoutAuthorization } from '../__fixtures__';
import {
  conferenceParticipantTokenIssuedData,
  conferenceParticipantTokenIssuedHeaders,
} from '../__fixtures__/conferenceParticipantTokenIssuedNotify';
import JsSIP from '../__fixtures__/jssip.mock';
import { doMockSipConnector } from '../doMock';

import type { SipConnector } from '../SipConnector';

describe('conference participant token issued notify', () => {
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
  it('event conference:participant-token-issued', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithoutAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve, reject) => {
      const { ua } = sipConnector.connectionManager;

      if (!ua) {
        reject(new Error('UA not initialized'));

        return;
      }

      sipConnector.on('api:conference:participant-token-issued', (data) => {
        expect(data).toEqual(conferenceParticipantTokenIssuedData);

        resolve();
      });

      JsSIP.triggerNewSipEvent(ua, conferenceParticipantTokenIssuedHeaders);
    });
  });
});
