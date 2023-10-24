import { createMediaStreamMock } from 'webrtc-mock';
import type SipConnector from '../SipConnector';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import createSipConnector from '../__fixtures__/doMock';
import JsSIP from '../__fixtures__/jssip.mock';
import { ADMIN_START_MAIN_CAM, ADMIN_STOP_MAIN_CAM } from '../constants';
import {
  CONTENT_TYPE_MAIN_CAM,
  HEADER_CONTENT_TYPE_NAME,
  HEADER_MAIN_CAM,
  HEADER_MAIN_CAM_RESOLUTION,
} from '../headers';
import { EEventsMainCAM } from '../types';

const headersMainCamControl: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_MAIN_CAM],
  [HEADER_MAIN_CAM, EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION],
  [HEADER_MAIN_CAM_RESOLUTION, '720'],
];

const headersAdminStartMainCam: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_MAIN_CAM],
  [HEADER_MAIN_CAM, EEventsMainCAM.ADMIN_START_MAIN_CAM],
];

const headersAdminStopMainCam: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_MAIN_CAM],
  [HEADER_MAIN_CAM, EEventsMainCAM.ADMIN_STOP_MAIN_CAM],
];

describe('main cam control', () => {
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

  it('event', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ mainCam: EEventsMainCAM; resolutionMainCam: string }>(
      (resolve) => {
        return sipConnector.onSession('main-cam-control', resolve);
      },
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

  it('admin start main cam', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      return sipConnector.onSession(ADMIN_START_MAIN_CAM, resolve);
    });
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersAdminStartMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });

  it('admin stop main cam', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      return sipConnector.onSession(ADMIN_STOP_MAIN_CAM, resolve);
    });
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersAdminStopMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });
});
