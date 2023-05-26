import { createMediaStreamMock } from 'webrtc-mock';
import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithAuthorization } from '../__mocks__';
import JsSIP from '../__mocks__/jssip.mock';
import SipConnector, { EUseLicense } from '../SipConnector';
import {
  HEADER_CONTENT_TYPE_NAME,
  CONTENT_TYPE_USE_LICENSE,
  HEADER_CONTENT_USE_LICENSE,
} from '../headers';
import { USE_LICENSE } from '../constants';

const headersUseLicenseAudio: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_USE_LICENSE],
  [HEADER_CONTENT_USE_LICENSE, EUseLicense.AUDIO],
];

const headersUseLicenseVideo: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_USE_LICENSE],
  [HEADER_CONTENT_USE_LICENSE, EUseLicense.VIDEO],
];

const headersUseLicenseAudioPlusContent: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_USE_LICENSE],
  [HEADER_CONTENT_USE_LICENSE, EUseLicense.AUDIOPLUSPRESENTATION],
];

describe('use license', () => {
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

  it('use license audio', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<EUseLicense>((resolve) => {
      return sipConnector.onSession(USE_LICENSE, resolve);
    });
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersUseLicenseAudio);
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
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersUseLicenseVideo);
    }

    return promise.then((license: EUseLicense) => {
      expect(license).toBe(EUseLicense.VIDEO);
    });
  });

  it('use license audio plus content', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const promise = new Promise<EUseLicense>((resolve) => {
      return sipConnector.onSession(USE_LICENSE, resolve);
    });
    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersUseLicenseAudioPlusContent);
    }

    return promise.then((license: EUseLicense) => {
      expect(license).toBe(EUseLicense.AUDIOPLUSPRESENTATION);
    });
  });
});
