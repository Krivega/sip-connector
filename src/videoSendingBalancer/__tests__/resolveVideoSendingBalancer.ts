/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';
import type SipConnector from '../../SipConnector';
import { dataForConnectionWithAuthorization } from '../../__fixtures__';
import JsSIP from '../../__fixtures__/jssip.mock';
import createSipConnector from '../../doMock';
import {
  CONTENT_TYPE_MAIN_CAM,
  HEADER_CONTENT_TYPE_NAME,
  HEADER_MAIN_CAM,
  HEADER_MAIN_CAM_RESOLUTION,
} from '../../headers';
import { EEventsMainCAM } from '../../types';
import findVideoSender from '../../utils/findVideoSender';
import { MINIMUM_BITRATE } from '../getMaxBitrateByWidth';
import getMaxBitrateByWidthAndCodec from '../getMaxBitrateByWidthAndCodec';
import resolveVideoSendingBalancer from '../index';

const number = '111';

const fhdWidth = 1920;
const fhdBitrate = getMaxBitrateByWidthAndCodec(fhdWidth);

const sdWidth = 640;
const sdHeight = 480;
const sdBitrate = getMaxBitrateByWidthAndCodec(sdWidth);

const headersResumeMainCam: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_MAIN_CAM],
  [HEADER_MAIN_CAM, EEventsMainCAM.RESUME_MAIN_CAM],
];

const headersPauseMainCam: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_MAIN_CAM],
  [HEADER_MAIN_CAM, EEventsMainCAM.PAUSE_MAIN_CAM],
];

const headersMaxMainCamResolution: [string, string][] = [
  [HEADER_CONTENT_TYPE_NAME, CONTENT_TYPE_MAIN_CAM],
  [HEADER_MAIN_CAM, EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION],
  [HEADER_MAIN_CAM_RESOLUTION, `${sdWidth}x${sdHeight}`],
];

describe('resolveVideoSendingBalancer', () => {
  let sipConnector: SipConnector;
  let mediaStream: MediaStream;
  let videoSendingBalancer: ReturnType<typeof resolveVideoSendingBalancer>;

  beforeEach(() => {
    sipConnector = createSipConnector();
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' }, width: { exact: fhdWidth } },
    });

    videoSendingBalancer = resolveVideoSendingBalancer(sipConnector);

    videoSendingBalancer.subscribe();
  });

  it('should be set actual mediaStreamTrack bitrate by RESUME_MAIN_CAM info', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const { connection } = sipConnector;

    if (!connection) {
      throw new Error('connection is not exist');
    }

    const senders = connection.getSenders();
    const sender = findVideoSender(senders);

    if (!sender) {
      throw new Error('sender is not exist');
    }

    const promiseSetResolution = new Promise<RTCRtpSendParameters>((resolve) => {
      // @ts-expect-error
      sender.getStats = async () => {
        return [];
      };

      // @ts-expect-error
      sender.getParameters = () => {
        return [
          {
            maxBitrate: sdBitrate,
          },
        ];
      };

      // @ts-expect-error
      sender.setParameters = resolve;
    });

    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersResumeMainCam);
    }

    const parameters = await promiseSetResolution;

    expect(parameters.encodings[0].maxBitrate).toEqual(fhdBitrate);
  });

  it('should be set minimum mediaStreamTrack bitrate by PAUSE_MAIN_CAM info', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const { connection } = sipConnector;

    if (!connection) {
      throw new Error('connection is not exist');
    }

    const senders = connection.getSenders();
    const sender = findVideoSender(senders);

    if (!sender) {
      throw new Error('sender is not exist');
    }

    const promiseSetResolution = new Promise<RTCRtpSendParameters>((resolve) => {
      // @ts-expect-error
      sender.getStats = async () => {
        return [];
      };

      // @ts-expect-error
      sender.getParameters = () => {
        return [
          {
            maxBitrate: fhdBitrate,
          },
        ];
      };

      // @ts-expect-error
      sender.setParameters = resolve;
    });

    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersPauseMainCam);
    }

    const parameters = await promiseSetResolution;

    expect(parameters.encodings[0].maxBitrate).toEqual(MINIMUM_BITRATE);
  });

  it('should be set max mediaStreamTrack bitrate by MAX_MAIN_CAM_RESOLUTION info', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);
    await sipConnector.call({ number, mediaStream });

    const { connection } = sipConnector;

    if (!connection) {
      throw new Error('connection is not exist');
    }

    const senders = connection.getSenders();
    const sender = findVideoSender(senders);

    if (!sender) {
      throw new Error('sender is not exist');
    }

    const promiseSetResolution = new Promise<RTCRtpSendParameters>((resolve) => {
      // @ts-expect-error
      sender.getStats = async () => {
        return [];
      };

      // @ts-expect-error
      sender.getParameters = () => {
        return [
          {
            maxBitrate: fhdBitrate,
          },
        ];
      };

      // @ts-expect-error
      sender.setParameters = resolve;
    });

    const { session } = sipConnector;

    if (session) {
      JsSIP.triggerNewInfo(session, headersMaxMainCamResolution);
    }

    const parameters = await promiseSetResolution;

    expect(parameters.encodings[0].maxBitrate).toEqual(sdBitrate);
  });
});
