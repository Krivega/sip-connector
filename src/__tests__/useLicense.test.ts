/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import { dataForConnectionWithAuthorization } from '../__fixtures__';
import JsSIP from '../__fixtures__/jssip.mock';
import { EContentTypeReceived, EKeyHeader, EContentUseLicense } from '../ApiManager';
import { doMockSipConnector } from '../doMock';

import type { SipConnector } from '../SipConnector';

const headersUseLicenseAudio: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.USE_LICENSE],
  [EKeyHeader.CONTENT_USE_LICENSE, EContentUseLicense.AUDIO],
];

const headersUseLicenseVideo: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.USE_LICENSE],
  [EKeyHeader.CONTENT_USE_LICENSE, EContentUseLicense.VIDEO],
];

const headersUseLicenseAudioPlusPresentation: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.USE_LICENSE],
  [EKeyHeader.CONTENT_USE_LICENSE, EContentUseLicense.AUDIOPLUSPRESENTATION],
];

describe('use license', () => {
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

  it('use license audio', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<EContentUseLicense>((resolve) => {
      sipConnector.on('api:use-license', resolve);
    });
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersUseLicenseAudio);
    }

    return promise.then((license: EContentUseLicense) => {
      expect(license).toBe(EContentUseLicense.AUDIO);
    });
  });

  it('use license video', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<EContentUseLicense>((resolve) => {
      sipConnector.on('api:use-license', resolve);
    });
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersUseLicenseVideo);
    }

    return promise.then((license: EContentUseLicense) => {
      expect(license).toBe(EContentUseLicense.VIDEO);
    });
  });

  it('use license audio plus presentation', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<EContentUseLicense>((resolve) => {
      sipConnector.on('api:use-license', resolve);
    });
    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

    if (establishedRTCSession) {
      JsSIP.triggerNewInfo(establishedRTCSession, headersUseLicenseAudioPlusPresentation);
    }

    return promise.then((license: EContentUseLicense) => {
      expect(license).toBe(EContentUseLicense.AUDIOPLUSPRESENTATION);
    });
  });
});
