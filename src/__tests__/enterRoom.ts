/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import { enterRoomData, enterRoomHeaders } from '../__fixtures__/enterRoom';
import JsSIP from '../__fixtures__/jssip.mock';
import { doMockSipConnector } from '../doMock';
import type SipConnector from '../SipConnector';

describe('enter room', () => {
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

    const promise = new Promise<{ room: string; participantName: string }>((resolve) => {
      sipConnector.onApi('enterRoom', (data: { room: string; participantName: string }) => {
        resolve(data);
      });
    });

    const { establishedRTCSession } = sipConnector.callManager;

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, enterRoomHeaders);
    }

    return promise.then((data) => {
      expect(data).toEqual(enterRoomData);
    });
  });
});
