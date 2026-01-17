/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import { dataForConnectionWithAuthorization } from '../__fixtures__';
import JsSIP from '../__fixtures__/jssip.mock';
import { EContentTypeReceived, EContentMainCAM, EKeyHeader } from '../ApiManager';
import { doMockSipConnector } from '../doMock';

import type { SipConnector } from '../SipConnector';

const headersMainCamControl: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EKeyHeader.MAIN_CAM, EContentMainCAM.MAX_MAIN_CAM_RESOLUTION],
  [EKeyHeader.MAIN_CAM_RESOLUTION, '720'],
];

const headersAdminStartMainCam: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EKeyHeader.MAIN_CAM, EContentMainCAM.ADMIN_START_MAIN_CAM],
];

const headersAdminStopMainCam: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EKeyHeader.MAIN_CAM, EContentMainCAM.ADMIN_STOP_MAIN_CAM],
];

const headersResumeMainCam: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EKeyHeader.MAIN_CAM, EContentMainCAM.RESUME_MAIN_CAM],
];

const headersPauseMainCam: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EKeyHeader.MAIN_CAM, EContentMainCAM.PAUSE_MAIN_CAM],
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

    const promise = new Promise<{ mainCam?: EContentMainCAM; resolutionMainCam?: string }>(
      (resolve) => {
        sipConnector.on('api:main-cam-control', resolve);
      },
    );
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersMainCamControl);
    }

    return promise.then(({ mainCam, resolutionMainCam }) => {
      expect(mainCam).toBe(EContentMainCAM.MAX_MAIN_CAM_RESOLUTION);
      expect(resolutionMainCam).toBe('720');
    });
  });

  it('admin start main cam', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      sipConnector.on('api:admin:start-main-cam', resolve);
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
      sipConnector.on('api:admin:stop-main-cam', resolve);
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

    const promise = new Promise<{ mainCam?: EContentMainCAM; resolutionMainCam?: string }>(
      (resolve) => {
        sipConnector.on('api:main-cam-control', resolve);
      },
    );

    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersResumeMainCam);
    }

    await promise.then(({ mainCam, resolutionMainCam }) => {
      expect(mainCam).toBe(EContentMainCAM.RESUME_MAIN_CAM);
      expect(resolutionMainCam).toBe(undefined);
    });
  });

  it('call MAIN_CAM_CONTROL event by PAUSE_MAIN_CAM info', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ mainCam?: EContentMainCAM; resolutionMainCam?: string }>(
      (resolve) => {
        sipConnector.on('api:main-cam-control', resolve);
      },
    );

    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersPauseMainCam);
    }

    await promise.then(({ mainCam, resolutionMainCam }) => {
      expect(mainCam).toBe(EContentMainCAM.PAUSE_MAIN_CAM);
      expect(resolutionMainCam).toBe(undefined);
    });
  });
});
