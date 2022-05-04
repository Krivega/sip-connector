import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithAuthorization } from '../__mocks__';
import JsSIP from '../__mocks__/jssip.mock';
import SipConnector, { EEventsMainCAM } from '../SipConnector';
import {
  HEADER_CONTENT_TYPE_NAME,
  HEADER_CONTENT_TYPE_MAIN_CAM,
  HEADER_MAIN_CAM,
} from '../headers';

const headersMainCamControl = [
  [HEADER_CONTENT_TYPE_NAME, HEADER_CONTENT_TYPE_MAIN_CAM],
  [HEADER_MAIN_CAM, EEventsMainCAM.ADMIN_STOP_MAIN_CAM],
];

describe('main cam remote control', () => {
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

    const promise = new Promise<{ mainCam: EEventsMainCAM }>((resolve) => {
      return sipConnector.onSession('main-cam-remote-control', resolve);
    });
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersMainCamControl);
    }

    return promise.then(({ mainCam }) => {
      expect(mainCam).toBe(EEventsMainCAM.ADMIN_STOP_MAIN_CAM);
    });
  });
});
