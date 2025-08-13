/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import { dataForConnectionWithAuthorization } from '../__fixtures__';
import JsSIP from '../__fixtures__/jssip.mock';
import {
  EContentTypeReceived,
  EEventsMainCAM,
  EEventsMic,
  EEventsSyncMediaState,
  EHeader,
} from '../ApiManager';
import { doMockSipConnector } from '../doMock';

import type { SipConnector } from '../SipConnector';

const headersSyncForcedAdminStartMainCam: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EHeader.MAIN_CAM, EEventsMainCAM.ADMIN_START_MAIN_CAM],
  [EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED],
];

const headersSyncNotForcedAdminStartMainCam: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EHeader.MAIN_CAM, EEventsMainCAM.ADMIN_START_MAIN_CAM],
  [EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_NOT_FORCED],
];

const headersSyncForcedAdminStopMainCam: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EHeader.MAIN_CAM, EEventsMainCAM.ADMIN_STOP_MAIN_CAM],
  [EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED],
];

const headersSyncNotForcedAdminStopMainCam: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EHeader.MAIN_CAM, EEventsMainCAM.ADMIN_STOP_MAIN_CAM],
  [EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_NOT_FORCED],
];

const headersSyncForcedAdminStartMic: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.MIC],
  [EHeader.MIC, EEventsMic.ADMIN_START_MIC],
  [EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED],
];

const headersSyncNotForcedAdminStartMic: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.MIC],
  [EHeader.MIC, EEventsMic.ADMIN_START_MIC],
  [EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_NOT_FORCED],
];

const headersSyncForcedAdminStopMic: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.MIC],
  [EHeader.MIC, EEventsMic.ADMIN_STOP_MIC],
  [EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED],
];

const headersSyncNotForcedAdminStopMic: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.MIC],
  [EHeader.MIC, EEventsMic.ADMIN_STOP_MIC],
  [EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_NOT_FORCED],
];

const headersSyncForcedResumeMainCam: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EHeader.MAIN_CAM, EEventsMainCAM.RESUME_MAIN_CAM],
  [EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED],
];

const headersSyncNotForcedResumeMainCam: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EHeader.MAIN_CAM, EEventsMainCAM.RESUME_MAIN_CAM],
  [EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_NOT_FORCED],
];

const headersSyncForcedPauseMainCam: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EHeader.MAIN_CAM, EEventsMainCAM.PAUSE_MAIN_CAM],
  [EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED],
];

const headersSyncNotForcedPauseMainCam: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EHeader.MAIN_CAM, EEventsMainCAM.PAUSE_MAIN_CAM],
  [EHeader.MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_NOT_FORCED],
];

describe('sync media state', () => {
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

  it('admin sync media state forced when start main cam', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      sipConnector.on('api:admin-start-main-cam', resolve);
    });
    const { establishedRTCSession } = sipConnector;

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersSyncForcedAdminStartMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(true);
    });
  });

  it('admin sync media state is not forced when start main cam', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      sipConnector.on('api:admin-start-main-cam', resolve);
    });
    const { establishedRTCSession } = sipConnector;

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersSyncNotForcedAdminStartMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });

  it('admin sync media state forced when stop main cam', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      sipConnector.on('api:admin-stop-main-cam', resolve);
    });
    const { establishedRTCSession } = sipConnector;

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersSyncForcedAdminStopMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(true);
    });
  });

  it('admin sync media state is not forced when stop main cam', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      sipConnector.on('api:admin-stop-main-cam', resolve);
    });
    const { establishedRTCSession } = sipConnector;

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersSyncNotForcedAdminStopMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });

  it('admin sync media state forced when start mic', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      sipConnector.on('api:admin-start-mic', resolve);
    });
    const { establishedRTCSession } = sipConnector;

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersSyncForcedAdminStartMic);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(true);
    });
  });

  it('admin sync media state is not forced when start mic', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      sipConnector.on('api:admin-start-mic', resolve);
    });
    const { establishedRTCSession } = sipConnector;

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersSyncNotForcedAdminStartMic);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });

  it('admin sync media state forced when stop mic', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      sipConnector.on('api:admin-stop-mic', resolve);
    });
    const { establishedRTCSession } = sipConnector;

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersSyncForcedAdminStopMic);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(true);
    });
  });

  it('admin sync media state is not forced when stop mic', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      sipConnector.on('api:admin-stop-mic', resolve);
    });
    const { establishedRTCSession } = sipConnector;

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersSyncNotForcedAdminStopMic);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });

  it('admin sync media state forced when resume main cam', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      sipConnector.on('api:admin-force-sync-media-state', resolve);
    });
    const { establishedRTCSession } = sipConnector;

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersSyncForcedResumeMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(true);
    });
  });

  it('admin sync media state is not forced when resume main cam', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      sipConnector.on('api:admin-force-sync-media-state', resolve);
    });
    const { establishedRTCSession } = sipConnector;

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersSyncNotForcedResumeMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });

  it('admin sync media state forced when pause main cam', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      sipConnector.on('api:admin-force-sync-media-state', resolve);
    });
    const { establishedRTCSession } = sipConnector;

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersSyncForcedPauseMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(true);
    });
  });

  it('admin sync media state is not forced when pause main cam', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      sipConnector.on('api:admin-force-sync-media-state', resolve);
    });
    const { establishedRTCSession } = sipConnector;

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersSyncNotForcedPauseMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });

  it('waitSyncMediaState force sync', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = sipConnector.waitSyncMediaState();
    const { establishedRTCSession } = sipConnector;

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersSyncForcedResumeMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(true);
    });
  });

  it('waitSyncMediaState do not force sync', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = sipConnector.waitSyncMediaState();
    const { establishedRTCSession } = sipConnector;

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersSyncNotForcedResumeMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });
});
