import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithoutAuthorization } from '../__mocks__';
import {
  conferenceParticipantTokenIssuedHeaders,
  conferenceParticipantTokenIssuedData,
} from '../__mocks__/conferenceParticipantTokenIssuedNotify';
import JsSIP from '../__mocks__/jssip.mock';
import SipConnector from '../SipConnector';

describe('conference participant token issued notify', () => {
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
  it('event conference:participant-token-issued', async () => {
    expect.assertions(1);

    const ua = await sipConnector.connect(dataForConnectionWithoutAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.on('conference:participant-token-issued', (data) => {
        expect(data).toEqual(conferenceParticipantTokenIssuedData);

        resolve();
      });

      // @ts-ignore
      JsSIP.triggerNewSipEvent(ua, conferenceParticipantTokenIssuedHeaders);
    });
  });
});
