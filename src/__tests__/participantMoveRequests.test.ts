/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

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

import type { SipConnector } from '../SipConnector';

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
    await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve, reject) => {
      sipConnector.on('api:participation:accepting-word-request', (data) => {
        expect(data).toEqual(acceptingWordRequestData);

        resolve();
      });

      const { ua } = sipConnector.connectionManager;

      if (!ua) {
        reject(new Error('UA not initialized'));

        return;
      }

      JsSIP.triggerNewSipEvent(ua, acceptingWordRequestHeaders);
    });
  });

  it('event participation:cancelling-word-request', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve, reject) => {
      sipConnector.on('api:participation:cancelling-word-request', (data) => {
        expect(data).toEqual(cancellingWordRequestData);

        resolve();
      });

      const { ua } = sipConnector.connectionManager;

      if (!ua) {
        reject(new Error('UA not initialized'));

        return;
      }

      JsSIP.triggerNewSipEvent(ua, cancellingWordRequestHeaders);
    });
  });

  it('event participant:move-request-to-stream', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);

    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve, reject) => {
      sipConnector.on('api:participant:move-request-to-stream', (data) => {
        expect(data).toEqual(moveRequestToStreamData);

        resolve();
      });

      const { ua } = sipConnector.connectionManager;

      if (!ua) {
        reject(new Error('UA not initialized'));

        return;
      }

      JsSIP.triggerNewSipEvent(ua, moveRequestToStreamHeaders);
    });
  });

  it('event participant:move-request-to-spectators', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    return new Promise<void>((resolve) => {
      sipConnector.on('api:participant:move-request-to-spectators', (data) => {
        expect(data).toEqual({ isSynthetic: true });

        resolve();
      });
      JsSIP.triggerNewInfo(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        sipConnector.getEstablishedRTCSession()!,
        moveRequestToSpectatorsHeaders,
      );
    });
  });
});
