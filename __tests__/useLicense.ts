/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import JsSIP from '../__fixtures__/jssip.mock';
import { USE_LICENSE } from '../src/constants';
import { doMockSipConnector } from '../src/doMock';
import {
    CONTENT_TYPE_USE_LICENSE,
    HEADER_CONTENT_TYPE_NAME,
    HEADER_CONTENT_USE_LICENSE,
} from '../src/headers';
import type SipConnector from '../src/SipConnector';
import { EUseLicense } from '../src/types';

const headersUseLicenseAudio: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_USE_LICENSE],
  [HEADER_CONTENT_USE_LICENSE, EUseLicense.AUDIO],
];

const headersUseLicenseVideo: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_USE_LICENSE],
  [HEADER_CONTENT_USE_LICENSE, EUseLicense.VIDEO],
];

const headersUseLicenseAudioPlusPresentation: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_USE_LICENSE],
  [HEADER_CONTENT_USE_LICENSE, EUseLicense.AUDIOPLUSPRESENTATION],
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

    const promise = new Promise<EUseLicense>((resolve) => {
      return sipConnector.onSession(USE_LICENSE, resolve);
    });
    const { rtcSession } = sipConnector;

    if (rtcSession) {
      JsSIP.triggerNewInfo(rtcSession, headersUseLicenseAudio);
    }

    return promise.then((license: EUseLicense) => {
      expect(license).toBe(EUseLicense.AUDIO);
    });
  });

  it('use license video', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<EUseLicense>((resolve) => {
      return sipConnector.onSession(USE_LICENSE, resolve);
    });
    const { rtcSession } = sipConnector;

    if (rtcSession) {
      JsSIP.triggerNewInfo(rtcSession, headersUseLicenseVideo);
    }

    return promise.then((license: EUseLicense) => {
      expect(license).toBe(EUseLicense.VIDEO);
    });
  });

  it('use license audio plus presentation', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<EUseLicense>((resolve) => {
      return sipConnector.onSession(USE_LICENSE, resolve);
    });
    const { rtcSession } = sipConnector;

    if (rtcSession) {
      JsSIP.triggerNewInfo(rtcSession, headersUseLicenseAudioPlusPresentation);
    }

    return promise.then((license: EUseLicense) => {
      expect(license).toBe(EUseLicense.AUDIOPLUSPRESENTATION);
    });
  });
});
