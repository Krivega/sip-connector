import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithAuthorization } from '../__mocks__';
import {
  moveRequestToConferenceHeaders,
  moveRequestToConferenceData,
  moveRequestToStreamHeaders,
  moveRequestToStreamData,
} from '../__mocks__/participantMoveRequests';
import JsSIP from '../__mocks__/jssip.mock';
import SipConnector from '../SipConnector';

describe('participants moveRequests', () => {
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
  it('event participant:move-request-to-conference', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.onSession('participant:move-request-to-conference', (data) => {
        expect(data).toEqual(moveRequestToConferenceData);

        resolve();
      });

      const { session } = sipConnector;

      if (session) {
        JsSIP.triggerNewInfo(session, moveRequestToConferenceHeaders);
      }
    });
  });

  it('event participant:move-request-to-stream', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.onSession('participant:move-request-to-stream', (data) => {
        expect(data).toEqual(moveRequestToStreamData);

        resolve();
      });

      const { session } = sipConnector;

      if (session) {
        JsSIP.triggerNewInfo(session, moveRequestToStreamHeaders);
      }
    });
  });
});
