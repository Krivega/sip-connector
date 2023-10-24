import { createMediaStreamMock } from 'webrtc-mock';
import type SipConnector from '../SipConnector';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import createSipConnector from '../__fixtures__/doMock';
import JsSIP from '../__fixtures__/jssip.mock';
import {
  ADMIN_FORCE_SYNC_MEDIA_STATE,
  ADMIN_START_MAIN_CAM,
  ADMIN_STOP_MAIN_CAM,
} from '../constants';
import {
  CONTENT_TYPE_MAIN_CAM,
  CONTENT_TYPE_MIC,
  HEADER_CONTENT_TYPE_NAME,
  HEADER_MAIN_CAM,
  HEADER_MEDIA_SYNC,
  HEADER_MIC,
} from '../headers';
import { EEventsMainCAM, EEventsMic, EEventsSyncMediaState } from '../types';

const headersSyncForcedAdminStartMainCam: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_MAIN_CAM],
  [HEADER_MAIN_CAM, EEventsMainCAM.ADMIN_START_MAIN_CAM],
  [HEADER_MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED],
];

const headersSyncNotForcedAdminStartMainCam: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_MAIN_CAM],
  [HEADER_MAIN_CAM, EEventsMainCAM.ADMIN_START_MAIN_CAM],
  [HEADER_MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_NOT_FORCED],
];

const headersSyncForcedAdminStopMainCam: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_MAIN_CAM],
  [HEADER_MAIN_CAM, EEventsMainCAM.ADMIN_STOP_MAIN_CAM],
  [HEADER_MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED],
];

const headersSyncNotForcedAdminStopMainCam: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_MAIN_CAM],
  [HEADER_MAIN_CAM, EEventsMainCAM.ADMIN_STOP_MAIN_CAM],
  [HEADER_MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_NOT_FORCED],
];

const headersSyncForcedAdminStartMic: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_MIC],
  [HEADER_MIC, EEventsMic.ADMIN_START_MIC],
  [HEADER_MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED],
];

const headersSyncNotForcedAdminStartMic: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_MIC],
  [HEADER_MIC, EEventsMic.ADMIN_START_MIC],
  [HEADER_MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_NOT_FORCED],
];

const headersSyncForcedAdminStopMic: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_MIC],
  [HEADER_MIC, EEventsMic.ADMIN_STOP_MIC],
  [HEADER_MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED],
];

const headersSyncNotForcedAdminStopMic: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_MIC],
  [HEADER_MIC, EEventsMic.ADMIN_STOP_MIC],
  [HEADER_MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_NOT_FORCED],
];

const headersSyncForcedResumeMainCam: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_MAIN_CAM],
  [HEADER_MAIN_CAM, EEventsMainCAM.RESUME_MAIN_CAM],
  [HEADER_MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED],
];

const headersSyncNotForcedResumeMainCam: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_MAIN_CAM],
  [HEADER_MAIN_CAM, EEventsMainCAM.RESUME_MAIN_CAM],
  [HEADER_MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_NOT_FORCED],
];

const headersSyncForcedPauseMainCam: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_MAIN_CAM],
  [HEADER_MAIN_CAM, EEventsMainCAM.PAUSE_MAIN_CAM],
  [HEADER_MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_FORCED],
];

const headersSyncNotForcedPauseMainCam: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_MAIN_CAM],
  [HEADER_MAIN_CAM, EEventsMainCAM.PAUSE_MAIN_CAM],
  [HEADER_MEDIA_SYNC, EEventsSyncMediaState.ADMIN_SYNC_NOT_FORCED],
];

describe('sync media state', () => {
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

  it('admin sync media state forced when start main cam', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      return sipConnector.onSession(ADMIN_START_MAIN_CAM, resolve);
    });
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersSyncForcedAdminStartMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(true);
    });
  });

  it('admin sync media state is not forced when start main cam', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      return sipConnector.onSession(ADMIN_START_MAIN_CAM, resolve);
    });
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersSyncNotForcedAdminStartMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });

  it('admin sync media state forced when stop main cam', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      return sipConnector.onSession(ADMIN_STOP_MAIN_CAM, resolve);
    });
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersSyncForcedAdminStopMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(true);
    });
  });

  it('admin sync media state is not forced when stop main cam', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      return sipConnector.onSession(ADMIN_STOP_MAIN_CAM, resolve);
    });
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersSyncNotForcedAdminStopMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });

  it('admin sync media state forced when start mic', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      return sipConnector.onSession('admin-start-mic', resolve);
    });
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersSyncForcedAdminStartMic);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(true);
    });
  });

  it('admin sync media state is not forced when start mic', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      return sipConnector.onSession('admin-start-mic', resolve);
    });
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersSyncNotForcedAdminStartMic);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });

  it('admin sync media state forced when stop mic', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      return sipConnector.onSession('admin-stop-mic', resolve);
    });
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersSyncForcedAdminStopMic);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(true);
    });
  });

  it('admin sync media state is not forced when stop mic', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      return sipConnector.onSession('admin-stop-mic', resolve);
    });
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersSyncNotForcedAdminStopMic);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });

  it('admin sync media state forced when resume main cam', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      return sipConnector.onSession(ADMIN_FORCE_SYNC_MEDIA_STATE, resolve);
    });
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersSyncForcedResumeMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(true);
    });
  });

  it('admin sync media state is not forced when resume main cam', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      return sipConnector.onSession(ADMIN_FORCE_SYNC_MEDIA_STATE, resolve);
    });
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersSyncNotForcedResumeMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });

  it('admin sync media state forced when pause main cam', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      return sipConnector.onSession(ADMIN_FORCE_SYNC_MEDIA_STATE, resolve);
    });
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersSyncForcedPauseMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(true);
    });
  });

  it('admin sync media state is not forced when pause main cam', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      return sipConnector.onSession(ADMIN_FORCE_SYNC_MEDIA_STATE, resolve);
    });
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersSyncNotForcedPauseMainCam);
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
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersSyncForcedResumeMainCam);
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
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersSyncNotForcedResumeMainCam);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });
});
