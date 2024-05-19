/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';
import type SipConnector from '../SipConnector';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import { enterRoomData, enterRoomHeaders } from '../__fixtures__/enterRoom';
import JsSIP from '../__fixtures__/jssip.mock';
import createSipConnector from '../doMock';

describe('enter room', () => {
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

  it('wait channels notify event authorized', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ room: string; participantName: string }>((resolve) => {
      sipConnector.onSession('enterRoom', (data: { room: string; participantName: string }) => {
        resolve(data);
      });
    });

    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, enterRoomHeaders);
    }

    return promise.then((data) => {
      expect(data).toEqual(enterRoomData);
    });
  });
});
