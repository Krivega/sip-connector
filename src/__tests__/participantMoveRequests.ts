import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithAuthorization } from '../__mocks__';
import {
  moveRequestToConferenceHeaders,
  moveRequestToConferenceData,
  cancelingWordRequestHeaders,
  cancelingWordRequestData,
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
    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.on('participant:move-request-to-conference', (data) => {
        expect(data).toEqual(moveRequestToConferenceData);

        resolve();
      });

      JsSIP.triggerNewSipEvent(ua, moveRequestToConferenceHeaders);
    });
  });

  it('event participant:canceling-word-request', async () => {
    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.on('participant:canceling-word-request', (data) => {
        expect(data).toEqual(cancelingWordRequestData);

        resolve();
      });

      JsSIP.triggerNewSipEvent(ua, cancelingWordRequestHeaders);
    });
  });

  it('event participant:move-request-to-stream', async () => {
    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.on('participant:move-request-to-stream', (data) => {
        expect(data).toEqual(moveRequestToStreamData);

        resolve();
      });

      JsSIP.triggerNewSipEvent(ua, moveRequestToStreamHeaders);
    });
  });
});
