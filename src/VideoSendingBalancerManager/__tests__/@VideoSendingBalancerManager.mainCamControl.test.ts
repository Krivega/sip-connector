import { createVideoMediaStreamTrackMock } from 'webrtc-mock';

import { createManagers } from '@/__fixtures__/createManagers';
import Request from '@/__fixtures__/Request.mock';
import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { EContentMainCAM, EContentTypeReceived, EKeyHeader } from '@/ApiManager';
import {
  createBalancerOptions,
  NO_MAX_RESOLUTION_BALANCER_OPTIONS,
} from '@/VideoSendingBalancer/__fixtures__';
import {
  calcMaxBitrateByWidthAndCodec,
  getMinimumBitrate,
} from '@/VideoSendingBalancer/calcBitrate';
import VideoSendingBalancerManager from '../@VideoSendingBalancerManager';

import type { IncomingInfoEvent } from '@krivega/jssip';
import type { ApiManager } from '@/ApiManager';
import type { CallManager } from '@/CallManager';
import type { IBalancerOptions } from '@/VideoSendingBalancer/types';

const BALANCING_START_DELAY = 10_000;
const CODEC = 'video/h264';

type TSenderLogEntry =
  | { type: 'setParameters'; scaleResolutionDownBy?: number }
  | { type: 'replaceTrack'; appliedScaleResolutionDownBy?: number };

type TObservedSender = {
  sender: RTCRtpSender;
  log: TSenderLogEntry[];
  getAppliedEncoding: () => RTCRtpEncodingParameters;
};

const createVideoTrack = (width: number, height: number): MediaStreamVideoTrack => {
  return createVideoMediaStreamTrackMock({
    constraints: { width, height },
  }) as MediaStreamVideoTrack;
};

const DEFAULT_SCALE_RESOLUTION_DOWN_BY = 1;

const normalizeEncoding = (encoding: RTCRtpEncodingParameters): RTCRtpEncodingParameters => {
  return {
    scaleResolutionDownBy: encoding.scaleResolutionDownBy ?? DEFAULT_SCALE_RESOLUTION_DOWN_BY,
    maxBitrate: encoding.maxBitrate,
  };
};

const createObservedSender = (track: MediaStreamVideoTrack): TObservedSender => {
  const sender = new RTCRtpSenderMock({ track }) as RTCRtpSender;
  const log: TSenderLogEntry[] = [];
  const originalSetParameters = sender.setParameters.bind(sender);
  const originalReplaceTrack = sender.replaceTrack.bind(sender);
  let appliedEncoding: RTCRtpEncodingParameters = {
    scaleResolutionDownBy: DEFAULT_SCALE_RESOLUTION_DOWN_BY,
  };

  sender.setParameters = async (parameters: RTCRtpSendParameters) => {
    await originalSetParameters(parameters);

    appliedEncoding = normalizeEncoding(parameters.encodings[0]);
    log.push({
      type: 'setParameters',
      scaleResolutionDownBy: appliedEncoding.scaleResolutionDownBy,
    });
  };

  sender.replaceTrack = async (newTrack: MediaStreamTrack | null) => {
    log.push({
      type: 'replaceTrack',
      appliedScaleResolutionDownBy: appliedEncoding.scaleResolutionDownBy,
    });

    return originalReplaceTrack(newTrack);
  };

  return {
    sender,
    log,
    getAppliedEncoding: () => {
      return appliedEncoding;
    },
  };
};

const mainCamHeaders = (
  mainCam: EContentMainCAM,
  resolutionMainCam?: string,
): [string, string][] => {
  const headers: [string, string][] = [
    [EKeyHeader.CONTENT_TYPE, EContentTypeReceived.MAIN_CAM],
    [EKeyHeader.MAIN_CAM, mainCam],
  ];

  if (resolutionMainCam !== undefined) {
    headers.push([EKeyHeader.MAIN_CAM_RESOLUTION, resolutionMainCam]);
  }

  return headers;
};

const HEADERS_MAX_720P = mainCamHeaders(EContentMainCAM.MAX_MAIN_CAM_RESOLUTION, '1280x720');
const HEADERS_PAUSE = mainCamHeaders(EContentMainCAM.PAUSE_MAIN_CAM);
const HEADERS_RESUME = mainCamHeaders(EContentMainCAM.RESUME_MAIN_CAM);

const MAX_BITRATE_1280 = calcMaxBitrateByWidthAndCodec(1280, CODEC);
const MAX_BITRATE_3840 = calcMaxBitrateByWidthAndCodec(3840, CODEC);

// параметры 4K-трека по каждой команде
const ENCODING_4K_BY_TRACK = { scaleResolutionDownBy: 1, maxBitrate: MAX_BITRATE_3840 };
const ENCODING_4K_LIMITED_TO_720P = { scaleResolutionDownBy: 3, maxBitrate: MAX_BITRATE_1280 };
const ENCODING_PAUSED = { scaleResolutionDownBy: 200, maxBitrate: getMinimumBitrate(CODEC) };

const COMMANDS: [string, [string, string][], RTCRtpEncodingParameters][] = [
  ['MAX_MAIN_CAM_RESOLUTION 1280x720', HEADERS_MAX_720P, ENCODING_4K_LIMITED_TO_720P],
  ['PAUSE_MAIN_CAM', HEADERS_PAUSE, ENCODING_PAUSED],
  ['RESUME_MAIN_CAM', HEADERS_RESUME, ENCODING_4K_BY_TRACK],
];

// команды, параметры которых отличаются от параметров по треку
const LIMITING_COMMANDS = COMMANDS.slice(0, 2);

const settle = async () => {
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(0);
};

describe('VideoSendingBalancerManager: команда main-cam-control', () => {
  let callManager: CallManager;
  let apiManager: ApiManager;
  let connection: RTCPeerConnectionMock;
  let manager: VideoSendingBalancerManager;
  let observed: TObservedSender;
  let track720: MediaStreamVideoTrack;
  let track4K: MediaStreamVideoTrack;

  const setConnection = (value: RTCPeerConnection | undefined) => {
    Object.defineProperty(callManager, 'connection', {
      value,
      writable: true,
      configurable: true,
    });
  };

  const createManager = (options: IBalancerOptions = NO_MAX_RESOLUTION_BALANCER_OPTIONS) => {
    manager = new VideoSendingBalancerManager(callManager, apiManager, options);
  };

  const sendMainCamInfo = (headers: [string, string][]) => {
    callManager.events.trigger('newInfo', {
      originator: 'remote',
      request: new Request(headers),
    } as unknown as IncomingInfoEvent);
  };

  const confirmCall = () => {
    callManager.events.trigger('peerconnection:confirmed', connection as RTCPeerConnection);
  };

  const confirmCallAndWaitBalancingStart = async () => {
    confirmCall();
    await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
    await settle();
  };

  const triggerRecvQualityChanged = () => {
    callManager.events.trigger('recv-quality-changed', {
      effectiveQuality: 'low',
      previousQuality: 'high',
      quality: 'low',
    });
  };

  const triggerEnded = () => {
    callManager.events.trigger('ended', {
      originator: 'remote',
      cause: 'Terminated',
    } as never);
  };

  const replaceTrack = async (track: MediaStreamVideoTrack) => {
    await observed.sender.replaceTrack(track);
    await settle();
  };

  beforeEach(() => {
    jest.useFakeTimers();

    ({ callManager, apiManager } = createManagers());

    track720 = createVideoTrack(1280, 720);
    track4K = createVideoTrack(3840, 2160);
    observed = createObservedSender(track720);
    connection = new RTCPeerConnectionMock(undefined, []);
    connection.senders = [observed.sender];

    setConnection(connection as RTCPeerConnection);
  });

  afterEach(() => {
    manager.stopBalancing();
    jest.useRealTimers();
  });

  describe('(а) команда в ожидании отложенного старта', () => {
    let startedHandler: jest.Mock;

    beforeEach(() => {
      observed = createObservedSender(track4K);
      connection.senders = [observed.sender];
      createManager();
      startedHandler = jest.fn();
      manager.on('balancing-started', startedHandler);
    });

    it.each(COMMANDS)(
      'по %s запускает балансировку сразу, очищает таймер и применяет команду',
      async (_name, headers, expectedEncoding) => {
        confirmCall();

        expect(manager.isBalancingScheduled).toBe(true);

        sendMainCamInfo(headers);
        await settle();

        expect(startedHandler).toHaveBeenCalledTimes(1);
        expect(manager.isBalancingActive).toBe(true);
        expect(manager.isBalancingScheduled).toBe(false);
        expect(observed.getAppliedEncoding()).toEqual(expectedEncoding);

        await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
        await settle();

        expect(startedHandler).toHaveBeenCalledTimes(1);
        expect(observed.getAppliedEncoding()).toEqual(expectedEncoding);
      },
    );

    it('без команды запускает балансировку только по истечении задержки', async () => {
      confirmCall();
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY - 1);
      await settle();

      expect(startedHandler).not.toHaveBeenCalled();
      expect(manager.isBalancingActive).toBe(false);

      await jest.advanceTimersByTimeAsync(1);
      await settle();

      expect(startedHandler).toHaveBeenCalledTimes(1);
      expect(manager.isBalancingActive).toBe(true);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_BY_TRACK);
    });

    it('остаётся активной после неудачного раннего старта и применяет следующую команду', async () => {
      setConnection(undefined);
      confirmCall();
      sendMainCamInfo(HEADERS_PAUSE);
      await settle();

      expect(startedHandler).toHaveBeenCalledTimes(1);
      expect(manager.isBalancingActive).toBe(true);
      expect(manager.isBalancingScheduled).toBe(false);

      setConnection(connection as RTCPeerConnection);
      sendMainCamInfo(HEADERS_MAX_720P);
      await settle();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });
  });

  describe('(б) замена трека 720p на 4K при действующем ограничении', () => {
    const findReplaceTrackEntry = (logLengthBeforeReplace: number) => {
      return observed.log.slice(logLengthBeforeReplace).find((entry) => {
        return entry.type === 'replaceTrack';
      });
    };

    beforeEach(() => {
      createManager();
    });

    it('выставляет scaleResolutionDownBy 3 до оригинального replaceTrack, если команда пришла при активной балансировке', async () => {
      await confirmCallAndWaitBalancingStart();
      sendMainCamInfo(HEADERS_MAX_720P);
      await settle();

      const logLengthBeforeReplace = observed.log.length;

      await replaceTrack(track4K);

      expect(findReplaceTrackEntry(logLengthBeforeReplace)).toEqual({
        type: 'replaceTrack',
        appliedScaleResolutionDownBy: 3,
      });
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });

    it('выставляет scaleResolutionDownBy 3 до оригинального replaceTrack, если команда пришла в ожидании старта', async () => {
      confirmCall();
      sendMainCamInfo(HEADERS_MAX_720P);
      await jest.advanceTimersByTimeAsync(5000);
      await settle();

      const logLengthBeforeReplace = observed.log.length;

      await replaceTrack(track4K);

      expect(findReplaceTrackEntry(logLengthBeforeReplace)).toEqual({
        type: 'replaceTrack',
        appliedScaleResolutionDownBy: 3,
      });
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });

    it('без команды и maxAvailableResolution не вызывает setParameters до оригинального replaceTrack', async () => {
      await confirmCallAndWaitBalancingStart();

      const logLengthBeforeReplace = observed.log.length;

      await replaceTrack(track4K);

      expect(observed.log[logLengthBeforeReplace]).toEqual({
        type: 'replaceTrack',
        appliedScaleResolutionDownBy: 1,
      });
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_BY_TRACK);
    });
  });

  describe('(в) команда при активной балансировке', () => {
    let startedHandler: jest.Mock;

    beforeEach(async () => {
      observed = createObservedSender(track4K);
      connection.senders = [observed.sender];
      createManager();
      await confirmCallAndWaitBalancingStart();
      startedHandler = jest.fn();
      manager.on('balancing-started', startedHandler);
    });

    it.each(COMMANDS)(
      'сохраняет и применяет %s без повторного balancing-started',
      async (_name, headers, expectedEncoding) => {
        sendMainCamInfo(headers);
        await settle();

        expect(startedHandler).not.toHaveBeenCalled();
        expect(observed.getAppliedEncoding()).toEqual(expectedEncoding);
      },
    );

    it('применяет последнюю команду: RESUME после PAUSE возвращает параметры по треку', async () => {
      sendMainCamInfo(HEADERS_PAUSE);
      await settle();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_PAUSED);

      sendMainCamInfo(HEADERS_RESUME);
      await settle();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_BY_TRACK);
    });

    it('сохраняет команду для балансировки по изменению трека', async () => {
      sendMainCamInfo(HEADERS_MAX_720P);
      await settle();
      await replaceTrack(createVideoTrack(3840, 2160));

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });

    it('применяет команду, когда connection появился после неудачного старта', async () => {
      manager.stopBalancing();
      await settle();
      setConnection(undefined);
      await confirmCallAndWaitBalancingStart();
      setConnection(connection as RTCPeerConnection);
      sendMainCamInfo(HEADERS_MAX_720P);
      await settle();

      expect(manager.isBalancingActive).toBe(true);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });
  });

  describe('(г) команда игнорируется вне ожидания старта и активной балансировки', () => {
    let startedHandler: jest.Mock;

    beforeEach(() => {
      observed = createObservedSender(track4K);
      connection.senders = [observed.sender];
      createManager();
      startedHandler = jest.fn();
      manager.on('balancing-started', startedHandler);
    });

    it.each(COMMANDS)('до peerconnection:confirmed игнорирует %s', async (_name, headers) => {
      sendMainCamInfo(headers);
      await settle();

      expect(manager.isBalancingActive).toBe(false);
      expect(startedHandler).not.toHaveBeenCalled();
      expect(observed.log).toEqual([]);

      await confirmCallAndWaitBalancingStart();

      expect(startedHandler).toHaveBeenCalledTimes(1);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_BY_TRACK);
    });

    it.each(COMMANDS)('в режиме зрителя игнорирует %s', async (_name, headers) => {
      await confirmCallAndWaitBalancingStart();
      callManager.events.trigger('recv-session-started', undefined as never);
      await settle();
      startedHandler.mockClear();

      const logLengthAfterStop = observed.log.length;

      sendMainCamInfo(headers);
      await settle();

      expect(manager.isBalancingActive).toBe(false);
      expect(manager.isBalancingScheduled).toBe(false);
      expect(startedHandler).not.toHaveBeenCalled();
      expect(observed.log.slice(logLengthAfterStop)).toEqual([]);

      callManager.events.trigger('recv-session-ended', undefined as never);
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
      await settle();

      expect(startedHandler).toHaveBeenCalledTimes(1);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_BY_TRACK);
    });

    it.each(COMMANDS)('после stopBalancing игнорирует %s', async (_name, headers) => {
      await confirmCallAndWaitBalancingStart();
      manager.stopBalancing();
      await settle();
      startedHandler.mockClear();

      const logLengthAfterStop = observed.log.length;

      sendMainCamInfo(headers);
      await settle();

      expect(manager.isBalancingActive).toBe(false);
      expect(manager.isBalancingScheduled).toBe(false);
      expect(startedHandler).not.toHaveBeenCalled();
      expect(observed.log.slice(logLengthAfterStop)).toEqual([]);

      await manager.startBalancing();
      await settle();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_BY_TRACK);
    });

    it('после recv-quality-changed игнорирует команду', async () => {
      await confirmCallAndWaitBalancingStart();
      triggerRecvQualityChanged();
      await settle();

      const logLengthAfterStop = observed.log.length;

      sendMainCamInfo(HEADERS_MAX_720P);
      await settle();

      expect(manager.isBalancingActive).toBe(false);
      expect(manager.isBalancingScheduled).toBe(false);
      expect(observed.log.slice(logLengthAfterStop)).toEqual([]);
    });
  });

  describe('(д) остановка стирает команду', () => {
    beforeEach(() => {
      observed = createObservedSender(track4K);
      connection.senders = [observed.sender];
      createManager();
    });

    it.each(LIMITING_COMMANDS)(
      'после stopBalancing и повторного старта без новой команды применяет параметры по треку вместо %s',
      async (_name, headers, expectedEncoding) => {
        await confirmCallAndWaitBalancingStart();
        sendMainCamInfo(headers);
        await settle();

        expect(observed.getAppliedEncoding()).toEqual(expectedEncoding);

        manager.stopBalancing();
        await settle();
        await manager.startBalancing();
        await settle();

        expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_BY_TRACK);
      },
    );

    it('после recv-quality-changed и ручного startBalancing применяет параметры по треку', async () => {
      await confirmCallAndWaitBalancingStart();
      sendMainCamInfo(HEADERS_MAX_720P);
      await settle();
      triggerRecvQualityChanged();
      await settle();
      await manager.startBalancing();
      await settle();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_BY_TRACK);
    });

    it('после recv-session-started не применяет команду, полученную при активной балансировке', async () => {
      await confirmCallAndWaitBalancingStart();
      sendMainCamInfo(HEADERS_MAX_720P);
      await settle();
      callManager.events.trigger('recv-session-started', undefined as never);
      await settle();
      callManager.events.trigger('recv-session-ended', undefined as never);
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
      await settle();

      expect(manager.isBalancingActive).toBe(true);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_BY_TRACK);
    });

    it('после recv-session-started не применяет команду, полученную в ожидании старта', async () => {
      confirmCall();
      sendMainCamInfo(HEADERS_MAX_720P);
      callManager.events.trigger('recv-session-started', undefined as never);
      await settle();
      callManager.events.trigger('recv-session-ended', undefined as never);
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
      await settle();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_BY_TRACK);
    });

    it('не переносит команду в следующий звонок после ended', async () => {
      await confirmCallAndWaitBalancingStart();
      sendMainCamInfo(HEADERS_MAX_720P);
      await settle();
      triggerEnded();
      await settle();
      await confirmCallAndWaitBalancingStart();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_BY_TRACK);
    });

    it('не переносит команду, пришедшую в ожидании старта, в следующий звонок после failed', async () => {
      confirmCall();
      sendMainCamInfo(HEADERS_MAX_720P);
      callManager.events.trigger('failed', {
        originator: 'remote',
        cause: 'Rejected',
      } as never);
      await settle();
      await confirmCallAndWaitBalancingStart();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_BY_TRACK);
    });
  });

  describe('(е) выход из режима зрителя', () => {
    let startedHandler: jest.Mock;
    let scheduledHandler: jest.Mock;

    beforeEach(async () => {
      observed = createObservedSender(track4K);
      connection.senders = [observed.sender];
      createManager();
      await confirmCallAndWaitBalancingStart();
      callManager.events.trigger('recv-session-started', undefined as never);
      await settle();
      startedHandler = jest.fn();
      scheduledHandler = jest.fn();
      manager.on('balancing-started', startedHandler);
      manager.on('balancing-scheduled', scheduledHandler);
    });

    it('recv-session-ended планирует старт по таймеру и эмитит balancing-scheduled', async () => {
      callManager.events.trigger('recv-session-ended', undefined as never);
      await settle();

      expect(scheduledHandler).toHaveBeenCalledTimes(1);
      expect(scheduledHandler).toHaveBeenCalledWith({ delay: BALANCING_START_DELAY });
      expect(manager.isBalancingScheduled).toBe(true);
      expect(manager.isBalancingActive).toBe(false);
      expect(startedHandler).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
      await settle();

      expect(startedHandler).toHaveBeenCalledTimes(1);
      expect(manager.isBalancingActive).toBe(true);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_BY_TRACK);
    });

    it('команда после recv-session-ended запускает балансировку сразу', async () => {
      callManager.events.trigger('recv-session-ended', undefined as never);
      sendMainCamInfo(HEADERS_MAX_720P);
      await settle();

      expect(startedHandler).toHaveBeenCalledTimes(1);
      expect(manager.isBalancingScheduled).toBe(false);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });
  });

  describe('(ж) maxAvailableResolution', () => {
    it('со статическим maxAvailableResolution 1920x1080 выставляет 4K-треку scaleResolutionDownBy 2', async () => {
      createManager(createBalancerOptions({ maxResolution: { width: 1920, height: 1080 } }));
      await confirmCallAndWaitBalancingStart();
      await replaceTrack(track4K);

      expect(observed.getAppliedEncoding()).toEqual({
        scaleResolutionDownBy: 2,
        maxBitrate: calcMaxBitrateByWidthAndCodec(1920, CODEC),
      });
    });
  });
});
