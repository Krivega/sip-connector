import { createMediaStreamMock } from 'webrtc-mock';
import SipConnector from '../SipConnector';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import createSipConnector from '../__fixtures__/doMock';
import JsSIP from '../__fixtures__/jssip.mock';
import {
  cancelingWordRequestData,
  cancelingWordRequestHeaders,
  moveRequestToConferenceData,
  moveRequestToConferenceHeaders,
  moveRequestToStreamData,
  moveRequestToStreamHeaders,
} from '../__fixtures__/participantMoveRequests';

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
