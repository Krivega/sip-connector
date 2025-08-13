/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import { dataForConnectionWithAuthorization } from '../__fixtures__';
import JsSIP from '../__fixtures__/jssip.mock';
import { EContentTypeReceived, EEventsMic, EHeader } from '../ApiManager';
import { doMockSipConnector } from '../doMock';

import type { SipConnector } from '../SipConnector';

const headersAdminStartMic: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.MIC],
  [EHeader.MIC, EEventsMic.ADMIN_START_MIC],
];

const headersAdminStopMic: [string, string][] = [
  [EHeader.CONTENT_TYPE, EContentTypeReceived.MIC],
  [EHeader.MIC, EEventsMic.ADMIN_STOP_MIC],
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
      sipConnector.on('api:admin-start-mic', resolve);
    });
    const { establishedRTCSession } = sipConnector;

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersAdminStartMic);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });

  it('admin stop mic', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<{ isSyncForced: boolean }>((resolve) => {
      sipConnector.on('api:admin-stop-mic', resolve);
    });
    const { establishedRTCSession } = sipConnector;

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersAdminStopMic);
    }

    return promise.then(({ isSyncForced }) => {
      expect(isSyncForced).toBe(false);
    });
  });
});
