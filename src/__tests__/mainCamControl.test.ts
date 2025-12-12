/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import { dataForConnectionWithAuthorization } from '../__fixtures__';
import JsSIP from '../__fixtures__/jssip.mock';
import { EContentTypeReceived, EEventsMainCAM, EHeader } from '../ApiManager';
import { doMockSipConnector } from '../doMock';

import type { SipConnector } from '../SipConnector';

const headersMainCamControl: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EHeader.MAIN_CAM, EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION],
  [EHeader.MAIN_CAM_RESOLUTION, '720'],
];

const headersAdminStartMainCam: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EHeader.MAIN_CAM, EEventsMainCAM.ADMIN_START_MAIN_CAM],
];

const headersAdminStopMainCam: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EHeader.MAIN_CAM, EEventsMainCAM.ADMIN_STOP_MAIN_CAM],
];

const headersResumeMainCam: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EHeader.MAIN_CAM, EEventsMainCAM.RESUME_MAIN_CAM],
];

const headersPauseMainCam: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EHeader.MAIN_CAM, EEventsMainCAM.PAUSE_MAIN_CAM],
];

describe('main cam control', () => {
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

  it('event', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ mainCam?: EEventsMainCAM; resolutionMainCam?: string }>(
      (resolve) => {
        sipConnector.on('api:main-cam-control', resolve);
      },
    );
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersMainCamControl);
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
      sipConnector.on('api:admin-start-main-cam', resolve);
    });
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersAdminStartMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });

  it('admin stop main cam', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      sipConnector.on('api:admin-stop-main-cam', resolve);
    });
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersAdminStopMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });

  it('call MAIN_CAM_CONTROL event by RESUME_MAIN_CAM info', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ mainCam?: EEventsMainCAM; resolutionMainCam?: string }>(
      (resolve) => {
        sipConnector.on('api:main-cam-control', resolve);
      },
    );

    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersResumeMainCam);
    }

    await promise.then(({ mainCam, resolutionMainCam }) => {
      expect(mainCam).toBe(EEventsMainCAM.RESUME_MAIN_CAM);
      expect(resolutionMainCam).toBe('');
    });
  });

  it('call MAIN_CAM_CONTROL event by PAUSE_MAIN_CAM info', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ mainCam?: EEventsMainCAM; resolutionMainCam?: string }>(
      (resolve) => {
        sipConnector.on('api:main-cam-control', resolve);
      },
    );

    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersPauseMainCam);
    }

    await promise.then(({ mainCam, resolutionMainCam }) => {
      expect(mainCam).toBe(EEventsMainCAM.PAUSE_MAIN_CAM);
      expect(resolutionMainCam).toBe('');
    });
  });
});
