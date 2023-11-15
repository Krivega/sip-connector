import { createMediaStreamMock } from 'webrtc-mock';
import type SipConnector from '../SipConnector';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import JsSIP from '../__fixtures__/jssip.mock';
import {
  cancelingWordRequestData,
  cancelingWordRequestHeaders,
  acceptingWordRequestData,
  acceptingWordRequestHeaders,
  moveRequestToStreamData,
  moveRequestToStreamHeaders,
} from '../__fixtures__/participantMoveRequests';
import createSipConnector from '../doMock';

describe('participants moveRequests', () => {
  const number = '111';

  let sipConnector: SipConnector;
  let mediaStream: MediaStream;

  beforeEach(() => {
    sipConnector = createSipConnector();
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });
  });
  it('event participation:accepting-word-request', async () => {
    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.on('participation:accepting-word-request', (data) => {
        expect(data).toEqual(acceptingWordRequestData);

        resolve();
      });

      JsSIP.triggerNewSipEvent(ua, acceptingWordRequestHeaders);
    });
  });

  it('event participation:canceling-word-request', async () => {
    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.on('participation:canceling-word-request', (data) => {
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
