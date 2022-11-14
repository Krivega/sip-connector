import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithAuthorization } from '../__mocks__';
import JsSIP from '../__mocks__/jssip.mock';
import SipConnector, { EEventsSyncMediaState } from '../SipConnector';
import {
  HEADER_CONTENT_TYPE_NAME,
  CONTENT_TYPE_SYNC_MEDIA_STATE,
  HEADER_SYNC_MEDIA_STATE,
} from '../headers';
import { ADMIN_FORCE_SYNC_MEDIA_STATE } from '../constants';

const headersAdminSyncMediaStateForced: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_SYNC_MEDIA_STATE],
  [HEADER_SYNC_MEDIA_STATE, EEventsSyncMediaState.ADMIN_SYNC_FORCED],
];

const headersAdminSyncMediaStateNotForced: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_SYNC_MEDIA_STATE],
  [HEADER_SYNC_MEDIA_STATE, EEventsSyncMediaState.ADMIN_SYNC_NOT_FORCED],
];

describe('sync media state', () => {
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

  it('admin sync media state forced', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      return sipConnector.onSession(ADMIN_FORCE_SYNC_MEDIA_STATE, resolve);
    });
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersAdminSyncMediaStateForced);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(true);
    });
  });

  it('admin sync media state is not forced', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      return sipConnector.onSession(ADMIN_FORCE_SYNC_MEDIA_STATE, resolve);
    });
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersAdminSyncMediaStateNotForced);
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
      JsSIP.triggerNewInfo(session, headersAdminSyncMediaStateForced);
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
      JsSIP.triggerNewInfo(session, headersAdminSyncMediaStateNotForced);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });
});
