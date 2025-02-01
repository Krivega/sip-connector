/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';
import type SipConnector from '../SipConnector';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import JsSIP from '../__fixtures__/jssip.mock';
import {
  acceptingWordRequestData,
  acceptingWordRequestHeaders,
  cancellingWordRequestData,
  cancellingWordRequestHeaders,
  moveRequestToSpectatorsHeaders,
  moveRequestToStreamData,
  moveRequestToStreamHeaders,
} from '../__fixtures__/participantMoveRequests';
import { doMockSipConnector } from '../doMock';

describe('participants moveRequests', () => {
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

  it('event participation:cancelling-word-request', async () => {
    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.on('participation:cancelling-word-request', (data) => {
        expect(data).toEqual(cancellingWordRequestData);

        resolve();
      });

      JsSIP.triggerNewSipEvent(ua, cancellingWordRequestHeaders);
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

  it('event participant:move-request-to-spectators', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.onSession('participant:move-request-to-spectators', (data) => {
        expect(data).toEqual(undefined);

        resolve();
      });

      JsSIP.triggerNewInfo(sipConnector.rtcSession!, moveRequestToSpectatorsHeaders);
    });
  });
});
