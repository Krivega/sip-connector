import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithAuthorization } from '../__mocks__';
import JsSIP from '../__mocks__/jssip.mock';
import { ESessionSyntheticsEventNames } from '../events';
import SipConnector, { EEventsMainCAM } from '../SipConnector';
import {
  HEADER_CONTENT_TYPE_NAME,
  HEADER_CONTENT_TYPE_MAIN_CAM,
  HEADER_MAIN_CAM,
  HEADER_MAIN_CAM_RESOLUTION,
} from '../headers';

const headersMainCamControl = [
  [HEADER_CONTENT_TYPE_NAME, HEADER_CONTENT_TYPE_MAIN_CAM],
  [HEADER_MAIN_CAM, EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION],
  [HEADER_MAIN_CAM_RESOLUTION, '720'],
];

describe('main cam control', () => {
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

    const promise = new Promise<{ mainCam: EEventsMainCAM; resolutionMainCam: string }>(
      (resolve) => {
        return sipConnector.onSession(ESessionSyntheticsEventNames.mainCamControl, resolve);
      }
    );
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersMainCamControl);
    }

    return promise.then(({ mainCam, resolutionMainCam }) => {
      expect(mainCam).toBe(EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION);
      expect(resolutionMainCam).toBe('720');
    });
  });
});
