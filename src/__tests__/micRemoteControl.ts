import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithAuthorization } from '../__mocks__';
import JsSIP from '../__mocks__/jssip.mock';
import SipConnector, { EEventsMic } from '../SipConnector';
import { HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_MIC, HEADER_MIC } from '../headers';

const headersMicControl = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_MIC],
  [HEADER_MIC, EEventsMic.ADMIN_STOP_MIC],
];

describe('mic remote control', () => {
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

  it('event', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ mic: EEventsMic }>((resolve) => {
      return sipConnector.onSession('mic-remote-control', resolve);
    });
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersMicControl);
    }

    return promise.then(({ mic }) => {
      expect(mic).toBe(EEventsMic.ADMIN_STOP_MIC);
    });
  });
});
