/// <reference types="jest" />
import { createMediaStreamMock } from 'webrtc-mock';

import { dataForConnectionWithAuthorization } from '@/__fixtures__';
import JsSIP from '@/__fixtures__/jssip.mock';
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { EContentMainCAM, EContentTypeReceived, EKeyHeader } from '@/ApiManager';
import { doMockSipConnector } from '@/doMock';
import findVideoSender from '@/utils/peerConnection/findVideoSender';
import { calcMaxBitrateByWidthAndCodec } from '@/VideoSendingBalancer/calcBitrate';

import type { SipConnector } from '@/SipConnector';

const BALANCING_START_DELAY = 10_000;
const CODEC = 'video/h264';
const DEFAULT_SCALE_RESOLUTION_DOWN_BY = 1;

const headersMaxMainCamResolution720p: [string, string][] = [
  [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
  [EKeyHeader.MAIN_CAM, EContentMainCAM.MAX_MAIN_CAM_RESOLUTION],
  [EKeyHeader.MAIN_CAM_RESOLUTION, '1280x720'],
];

type TSenderLogEntry =
  | { type: 'setParameters'; scaleResolutionDownBy: number }
  | { type: 'replaceTrack'; appliedScaleResolutionDownBy: number };

const createStream = (width: number, height: number): MediaStream => {
  return createMediaStreamMock({
    audio: { deviceId: { exact: 'audioDeviceId' } },
    video: {
      deviceId: { exact: 'videoDeviceId' },
      width: { exact: width },
      height: { exact: height },
    },
  });
};

const SIP_MOCK_FLOW_DURATION = 1000;

const waitWithTimers = async <T>(promise: Promise<T>): Promise<T> => {
  await jest.advanceTimersByTimeAsync(SIP_MOCK_FLOW_DURATION);

  return promise;
};

const settle = async () => {
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(0);
};

describe('SipConnector: ограничение MAXMAINCAMRESOLUTION до старта балансировки', () => {
  const number = '111';

  let sipConnector: SipConnector;
  let log: TSenderLogEntry[];
  let appliedScaleBySender: WeakMap<RTCRtpSender, number>;
  let appliedMaxBitrateBySender: WeakMap<RTCRtpSender, number | undefined>;
  let setParametersSpy: jest.SpyInstance;
  let replaceTrackSpy: jest.SpyInstance;

  const getVideoSender = (): RTCRtpSender => {
    const { connection } = sipConnector;

    if (!connection) {
      throw new Error('connection is not exist');
    }

    const sender = findVideoSender(connection.getSenders());

    if (!sender) {
      throw new Error('sender is not exist');
    }

    return sender;
  };

  beforeEach(() => {
    jest.useFakeTimers();

    log = [];
    appliedScaleBySender = new WeakMap();
    appliedMaxBitrateBySender = new WeakMap();

    const originalSetParameters = RTCRtpSenderMock.prototype.setParameters;
    const originalReplaceTrack = RTCRtpSenderMock.prototype.replaceTrack;

    setParametersSpy = jest
      .spyOn(RTCRtpSenderMock.prototype, 'setParameters')
      .mockImplementation(async function setParameters(
        this: RTCRtpSenderMock,
        parameters: RTCRtpSendParameters,
      ) {
        await originalSetParameters.call(this, parameters);

        if (this.track?.kind !== 'video') {
          return;
        }

        const scaleResolutionDownBy =
          parameters.encodings[0]?.scaleResolutionDownBy ?? DEFAULT_SCALE_RESOLUTION_DOWN_BY;

        appliedScaleBySender.set(this, scaleResolutionDownBy);
        appliedMaxBitrateBySender.set(this, parameters.encodings[0]?.maxBitrate);
        log.push({ type: 'setParameters', scaleResolutionDownBy });
      });

    replaceTrackSpy = jest
      .spyOn(RTCRtpSenderMock.prototype, 'replaceTrack')
      .mockImplementation(async function replaceTrack(
        this: RTCRtpSenderMock,
        track: MediaStreamTrack | null,
      ) {
        if (this.track?.kind === 'video') {
          log.push({
            type: 'replaceTrack',
            appliedScaleResolutionDownBy:
              appliedScaleBySender.get(this) ?? DEFAULT_SCALE_RESOLUTION_DOWN_BY,
          });
        }

        return originalReplaceTrack.call(this, track);
      });

    sipConnector = doMockSipConnector();
  });

  afterEach(() => {
    setParametersSpy.mockRestore();
    replaceTrackSpy.mockRestore();
    jest.useRealTimers();
  });

  const callWithLimitBeforeBalancingAndReplaceTo4K = async (
    delayBeforeReplace = BALANCING_START_DELAY,
  ): Promise<number> => {
    await waitWithTimers(sipConnector.connect(dataForConnectionWithAuthorization));
    await waitWithTimers(sipConnector.call({ number, mediaStream: createStream(1280, 720) }));

    const establishedRTCSession = sipConnector.getEstablishedRTCSession();

    if (!establishedRTCSession) {
      throw new Error('rtcSession is not established');
    }

    JsSIP.triggerNewInfo(establishedRTCSession, headersMaxMainCamResolution720p);
    await jest.advanceTimersByTimeAsync(delayBeforeReplace);
    await settle();

    const logLengthBeforeReplace = log.length;

    await sipConnector.replaceMediaStream(createStream(3840, 2160), {
      contentHint: 'detail',
      degradationPreference: 'maintain-resolution',
    });
    await settle();

    return logLengthBeforeReplace;
  };

  it('ограничивает 4K-трек до 1280x720 после замены потока, если команда пришла до старта балансировки', async () => {
    await callWithLimitBeforeBalancingAndReplaceTo4K();

    const videoSender = getVideoSender();

    expect(sipConnector.videoSendingBalancerManager.isBalancingActive).toBe(true);
    expect(appliedScaleBySender.get(videoSender)).toBe(3);
    expect(appliedMaxBitrateBySender.get(videoSender)).toBe(
      calcMaxBitrateByWidthAndCodec(1280, CODEC),
    );
  });

  it('выставляет scaleResolutionDownBy 3 до оригинального replaceTrack, если команда пришла до старта балансировки', async () => {
    const logLengthBeforeReplace = await callWithLimitBeforeBalancingAndReplaceTo4K();

    const replaceTrackEntry = log.slice(logLengthBeforeReplace).find((entry) => {
      return entry.type === 'replaceTrack';
    });

    expect(replaceTrackEntry).toEqual({
      type: 'replaceTrack',
      appliedScaleResolutionDownBy: 3,
    });
  });

  it('выставляет scaleResolutionDownBy 3 до оригинального replaceTrack при замене потока на 4K до истечения задержки старта', async () => {
    const logLengthBeforeReplace = await callWithLimitBeforeBalancingAndReplaceTo4K(5000);

    const replaceTrackEntry = log.slice(logLengthBeforeReplace).find((entry) => {
      return entry.type === 'replaceTrack';
    });

    expect(replaceTrackEntry).toEqual({
      type: 'replaceTrack',
      appliedScaleResolutionDownBy: 3,
    });
    expect(appliedScaleBySender.get(getVideoSender())).toBe(3);
  });
});
