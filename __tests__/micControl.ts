/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import JsSIP from '../__fixtures__/jssip.mock';
import { doMockSipConnector } from '../src/doMock';
import { CONTENT_TYPE_MIC, HEADER_CONTENT_TYPE_NAME, HEADER_MIC } from '../src/headers';
import type SipConnector from '../src/SipConnector';
import { EEventsMic } from '../src/types';

const headersAdminStartMic: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_MIC],
  [HEADER_MIC, EEventsMic.ADMIN_START_MIC],
];

const headersAdminStopMic: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_MIC],
  [HEADER_MIC, EEventsMic.ADMIN_STOP_MIC],
];

describe('mic control', () => {
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

  it('admin start mic', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      return sipConnector.onSession('admin-start-mic', resolve);
    });
    const { rtcSession } = sipConnector;

    if (rtcSession) {
      JsSIP.triggerNewInfo(rtcSession, headersAdminStartMic);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });

  it('admin stop mic', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      return sipConnector.onSession('admin-stop-mic', resolve);
    });
    const { rtcSession } = sipConnector;

    if (rtcSession) {
      JsSIP.triggerNewInfo(rtcSession, headersAdminStopMic);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });
});
