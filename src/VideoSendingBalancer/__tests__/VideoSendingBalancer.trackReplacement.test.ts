/// <reference types="jest" />
import { createVideoMediaStreamTrackMock } from 'webrtc-mock';

import delayPromise from '@/__fixtures__/delayPromise';
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { EContentMainCAM } from '@/ApiManager';
import VideoSendingBalancer from '../@VideoSendingBalancer';
import { NO_MAX_RESOLUTION_BALANCER_OPTIONS } from '../__fixtures__';
import { calcMaxBitrateByWidthAndCodec } from '../calcBitrate';

import type { IMainCamHeaders } from '../types';

const DEFAULT_SCALE_RESOLUTION_DOWN_BY = 1;
const POLL_INTERVAL_MS = 20;
const CODEC = 'video/h264';

const HEADERS_MAX_720P: IMainCamHeaders = {
  mainCam: EContentMainCAM.MAX_MAIN_CAM_RESOLUTION,
  resolutionMainCam: '1280x720',
};

const HEADERS_MAX_360P: IMainCamHeaders = {
  mainCam: EContentMainCAM.MAX_MAIN_CAM_RESOLUTION,
  resolutionMainCam: '640x360',
};

type TSenderLogEntry =
  | { type: 'setParameters'; scaleResolutionDownBy: number }
  | { type: 'replaceTrack'; appliedScaleResolutionDownBy: number };

const createVideoTrack = (width: number, height: number): MediaStreamVideoTrack => {
  return createVideoMediaStreamTrackMock({
    constraints: { width, height },
  }) as MediaStreamVideoTrack;
};

const createCodecStats = (): RTCStatsReport => {
  return new Map([['codec', { type: 'codec', mimeType: CODEC }]]);
};

describe('VideoSendingBalancer: замена трека при действующем ограничении', () => {
  let balancer: VideoSendingBalancer;
  let sender: RTCRtpSender;
  let log: TSenderLogEntry[];
  let appliedScaleResolutionDownBy: number;
  let setParametersGate: Promise<void> | undefined;
  let track4K: MediaStreamVideoTrack;

  // так команду применяет VideoSendingBalancerManager при активной балансировке
  const applyMainCamControl = (headers: IMainCamHeaders) => {
    balancer.setServerHeaders(headers);
    balancer.balance().catch(() => {});
  };

  const getLogFromReplacementStart = (logLengthBeforeReplace: number) => {
    return log.slice(logLengthBeforeReplace);
  };

  beforeEach(async () => {
    track4K = createVideoTrack(3840, 2160);
    sender = new RTCRtpSenderMock({ track: createVideoTrack(1280, 720) });
    log = [];
    appliedScaleResolutionDownBy = DEFAULT_SCALE_RESOLUTION_DOWN_BY;
    setParametersGate = undefined;

    const originalSetParameters = sender.setParameters.bind(sender);
    const originalReplaceTrack = sender.replaceTrack.bind(sender);

    sender.setParameters = async (parameters: RTCRtpSendParameters) => {
      await setParametersGate;
      await originalSetParameters(parameters);

      appliedScaleResolutionDownBy =
        parameters.encodings[0].scaleResolutionDownBy ?? DEFAULT_SCALE_RESOLUTION_DOWN_BY;
      log.push({ type: 'setParameters', scaleResolutionDownBy: appliedScaleResolutionDownBy });
    };
    sender.replaceTrack = async (track: MediaStreamTrack | null) => {
      log.push({ type: 'replaceTrack', appliedScaleResolutionDownBy });

      return originalReplaceTrack(track);
    };

    const connection = {
      getSenders: () => {
        return [sender];
      },
    } as unknown as RTCPeerConnection;

    balancer = new VideoSendingBalancer(
      () => {
        return connection;
      },
      { ...NO_MAX_RESOLUTION_BALANCER_OPTIONS, pollIntervalMs: POLL_INTERVAL_MS },
    );
    applyMainCamControl(HEADERS_MAX_720P);
    await delayPromise(0);
  });

  afterEach(() => {
    balancer.reset();
  });

  it('должен выставить scaleResolutionDownBy 3 до оригинального replaceTrack при замене 720p на 4K', async () => {
    const logLengthBeforeReplace = log.length;

    await sender.replaceTrack(track4K);
    await delayPromise(0);

    expect(getLogFromReplacementStart(logLengthBeforeReplace)).toEqual([
      { type: 'setParameters', scaleResolutionDownBy: 3 },
      { type: 'replaceTrack', appliedScaleResolutionDownBy: 3 },
    ]);
    expect(sender.getParameters().encodings[0]).toEqual({
      scaleResolutionDownBy: 3,
      maxBitrate: calcMaxBitrateByWidthAndCodec(1280, CODEC),
    });
  });

  it.each([
    [
      'приходит main-cam-control',
      () => {
        applyMainCamControl(HEADERS_MAX_720P);
      },
    ],
    [
      'балансировка запускается по изменению трека',
      () => {
        balancer.balance().catch(() => {});
      },
    ],
  ])(
    'не должен ослаблять ограничение, если во время получения кодека подготовкой %s',
    async (_name, startConcurrentBalancing) => {
      const preparationStats = Promise.withResolvers<RTCStatsReport>();
      const balancingStats = Promise.withResolvers<RTCStatsReport>();

      jest
        .spyOn(sender, 'getStats')
        .mockReturnValueOnce(preparationStats.promise)
        .mockReturnValueOnce(balancingStats.promise);

      const logLengthBeforeReplace = log.length;
      const replacing = sender.replaceTrack(track4K);

      startConcurrentBalancing();
      preparationStats.resolve(createCodecStats());
      balancingStats.resolve(createCodecStats());
      await replacing;
      await delayPromise(0);

      const logFromReplacementStart = getLogFromReplacementStart(logLengthBeforeReplace);

      expect(logFromReplacementStart).toContainEqual({
        type: 'replaceTrack',
        appliedScaleResolutionDownBy: 3,
      });
      expect(
        logFromReplacementStart.filter((entry) => {
          return entry.type === 'setParameters' && entry.scaleResolutionDownBy !== 3;
        }),
      ).toEqual([]);
    },
  );

  it('должен дождаться применения балансировки, вытеснившей подготовку в очереди, до оригинального replaceTrack', async () => {
    const runningTaskGate = Promise.withResolvers<undefined>();
    const lastTaskGate = Promise.withResolvers<undefined>();

    setParametersGate = runningTaskGate.promise;
    applyMainCamControl(HEADERS_MAX_360P);
    await delayPromise(0);

    const logLengthBeforeReplace = log.length;
    const replacing = sender.replaceTrack(track4K);

    await delayPromise(0);
    applyMainCamControl(HEADERS_MAX_720P);
    await delayPromise(0);
    setParametersGate = lastTaskGate.promise;
    runningTaskGate.resolve(undefined);
    await delayPromise(0);
    setParametersGate = undefined;
    lastTaskGate.resolve(undefined);
    await replacing;
    await delayPromise(0);

    expect(getLogFromReplacementStart(logLengthBeforeReplace)).toEqual([
      { type: 'setParameters', scaleResolutionDownBy: 2 },
      { type: 'setParameters', scaleResolutionDownBy: 3 },
      { type: 'replaceTrack', appliedScaleResolutionDownBy: 3 },
    ]);
  });

  describe('reset во время подготовки замены трека', () => {
    let preparationStats: PromiseWithResolvers<RTCStatsReport>;

    const deferPreparationStats = () => {
      preparationStats = Promise.withResolvers<RTCStatsReport>();
      jest.spyOn(sender, 'getStats').mockReturnValueOnce(preparationStats.promise);
    };

    it('не должен применять параметры и балансировать после reset, в том числе при изменении размера трека', async () => {
      const balanceSpy = jest.spyOn(balancer, 'balance');

      deferPreparationStats();

      const replacing = sender.replaceTrack(track4K);

      await delayPromise(0);
      balancer.reset();
      await delayPromise(0);

      const logLengthAfterReset = log.length;

      preparationStats.resolve(createCodecStats());
      await replacing;
      jest.spyOn(track4K, 'getSettings').mockReturnValue({ width: 1920, height: 1080 });
      await delayPromise(POLL_INTERVAL_MS * 5);

      expect(getLogFromReplacementStart(logLengthAfterReset)).toEqual([
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 1 },
      ]);
      expect(balanceSpy).not.toHaveBeenCalled();
    });

    it('должен оставить последними параметры reset, если reset вызван посреди подготовки', async () => {
      applyMainCamControl(HEADERS_MAX_360P);
      await delayPromise(0);

      const logLengthBeforeReplace = log.length;

      deferPreparationStats();

      const replacing = sender.replaceTrack(track4K);

      await delayPromise(0);
      balancer.reset();
      await delayPromise(0);
      preparationStats.resolve(createCodecStats());
      await replacing;
      await delayPromise(0);

      expect(getLogFromReplacementStart(logLengthBeforeReplace)).toEqual([
        { type: 'setParameters', scaleResolutionDownBy: 1 },
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 1 },
      ]);
    });
  });

  it('должен применить команду, сохранённую после reset во время ожидания кодека балансировкой', async () => {
    const balancingStats = Promise.withResolvers<RTCStatsReport>();

    jest.spyOn(sender, 'getStats').mockReturnValueOnce(balancingStats.promise);

    const balancing = balancer.balance();

    balancer.reset();
    balancer.setServerHeaders(HEADERS_MAX_360P);
    await delayPromise(0);
    balancingStats.resolve(createCodecStats());

    const result = await balancing;

    expect(result.isChanged).toBe(true);
    expect(log.at(-1)).toEqual({ type: 'setParameters', scaleResolutionDownBy: 2 });
  });

  it('должен выполнить две замены подряд без ожидания в порядке вызова и оставить корректные параметры последнего трека', async () => {
    const track720 = createVideoTrack(1280, 720);
    const logLengthBeforeReplace = log.length;

    const firstReplacing = sender.replaceTrack(track4K);
    const secondReplacing = sender.replaceTrack(track720);

    await Promise.all([firstReplacing, secondReplacing]);
    await delayPromise(0);

    const replaceTrackEntries = getLogFromReplacementStart(logLengthBeforeReplace).filter(
      (entry) => {
        return entry.type === 'replaceTrack';
      },
    );

    expect(replaceTrackEntries).toEqual([
      { type: 'replaceTrack', appliedScaleResolutionDownBy: 3 },
      { type: 'replaceTrack', appliedScaleResolutionDownBy: 3 },
    ]);
    expect(sender.track).toBe(track720);
    expect(sender.getParameters().encodings[0]).toEqual({
      scaleResolutionDownBy: 1,
      maxBitrate: calcMaxBitrateByWidthAndCodec(1280, CODEC),
    });
  });
});
