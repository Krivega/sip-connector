/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import { dataForConnectionWithAuthorization } from '../__fixtures__';
import JsSIP from '../__fixtures__/jssip.mock';
import {
  EContentTypeReceived,
  EContentMainCAM,
  EContentMic,
  EContentSyncMediaState,
  EKeyHeader,
} from '../ApiManager';
import { doMockSipConnector } from '../doMock';

import type { SipConnector } from '../SipConnector';

const headersSyncForcedAdminStartMainCam: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EKeyHeader.MAIN_CAM, EContentMainCAM.ADMIN_START_MAIN_CAM],
  [EKeyHeader.MEDIA_SYNC, EContentSyncMediaState.ADMIN_SYNC_FORCED],
];

const headersSyncNotForcedAdminStartMainCam: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EKeyHeader.MAIN_CAM, EContentMainCAM.ADMIN_START_MAIN_CAM],
  [EKeyHeader.MEDIA_SYNC, EContentSyncMediaState.ADMIN_SYNC_NOT_FORCED],
];

const headersSyncForcedAdminStopMainCam: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EKeyHeader.MAIN_CAM, EContentMainCAM.ADMIN_STOP_MAIN_CAM],
  [EKeyHeader.MEDIA_SYNC, EContentSyncMediaState.ADMIN_SYNC_FORCED],
];

const headersSyncNotForcedAdminStopMainCam: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EKeyHeader.MAIN_CAM, EContentMainCAM.ADMIN_STOP_MAIN_CAM],
  [EKeyHeader.MEDIA_SYNC, EContentSyncMediaState.ADMIN_SYNC_NOT_FORCED],
];

const headersSyncForcedAdminStartMic: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MIC],
  [EKeyHeader.MIC, EContentMic.ADMIN_START_MIC],
  [EKeyHeader.MEDIA_SYNC, EContentSyncMediaState.ADMIN_SYNC_FORCED],
];

const headersSyncNotForcedAdminStartMic: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MIC],
  [EKeyHeader.MIC, EContentMic.ADMIN_START_MIC],
  [EKeyHeader.MEDIA_SYNC, EContentSyncMediaState.ADMIN_SYNC_NOT_FORCED],
];

const headersSyncForcedAdminStopMic: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MIC],
  [EKeyHeader.MIC, EContentMic.ADMIN_STOP_MIC],
  [EKeyHeader.MEDIA_SYNC, EContentSyncMediaState.ADMIN_SYNC_FORCED],
];

const headersSyncNotForcedAdminStopMic: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MIC],
  [EKeyHeader.MIC, EContentMic.ADMIN_STOP_MIC],
  [EKeyHeader.MEDIA_SYNC, EContentSyncMediaState.ADMIN_SYNC_NOT_FORCED],
];

const headersSyncForcedResumeMainCam: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EKeyHeader.MAIN_CAM, EContentMainCAM.RESUME_MAIN_CAM],
  [EKeyHeader.MEDIA_SYNC, EContentSyncMediaState.ADMIN_SYNC_FORCED],
];

const headersSyncNotForcedResumeMainCam: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EKeyHeader.MAIN_CAM, EContentMainCAM.RESUME_MAIN_CAM],
  [EKeyHeader.MEDIA_SYNC, EContentSyncMediaState.ADMIN_SYNC_NOT_FORCED],
];

const headersSyncForcedPauseMainCam: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EKeyHeader.MAIN_CAM, EContentMainCAM.PAUSE_MAIN_CAM],
  [EKeyHeader.MEDIA_SYNC, EContentSyncMediaState.ADMIN_SYNC_FORCED],
];

const headersSyncNotForcedPauseMainCam: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EKeyHeader.MAIN_CAM, EContentMainCAM.PAUSE_MAIN_CAM],
  [EKeyHeader.MEDIA_SYNC, EContentSyncMediaState.ADMIN_SYNC_NOT_FORCED],
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
      sipConnector.on('api:admin:start-main-cam', resolve);
    });
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

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
      sipConnector.on('api:admin:start-main-cam', resolve);
    });
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

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
      sipConnector.on('api:admin:stop-main-cam', resolve);
    });
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

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
      sipConnector.on('api:admin:stop-main-cam', resolve);
    });
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

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
      sipConnector.on('api:admin:start-mic', resolve);
    });
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

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
      sipConnector.on('api:admin:start-mic', resolve);
    });
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

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
      sipConnector.on('api:admin:stop-mic', resolve);
    });
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

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
      sipConnector.on('api:admin:stop-mic', resolve);
    });
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

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
      sipConnector.on('api:admin:force-sync-media-state', resolve);
    });
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

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
      sipConnector.on('api:admin:force-sync-media-state', resolve);
    });
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

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
      sipConnector.on('api:admin:force-sync-media-state', resolve);
    });
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

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
      sipConnector.on('api:admin:force-sync-media-state', resolve);
    });
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

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
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

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
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersSyncNotForcedResumeMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });
});
