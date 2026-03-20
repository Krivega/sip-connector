import { createVideoMediaStreamTrackMock } from 'webrtc-mock';

import {
  createEvents as createCallEvents,
  type CallManager,
  type TCallEvents,
} from '@/CallManager';
import { createEvents as createStatsEvents } from '@/StatsPeerConnection';
import MainStreamHeathMonitor from '../@MainStreamHealthMonitor';
import {
  HEALTH_SNAPSHOT_EVENT_NAME,
  INBOUND_VIDEO_PROBLEM_DETECTED_EVENT_NAME,
  INBOUND_VIDEO_PROBLEM_RESET_EVENT_NAME,
  INBOUND_VIDEO_PROBLEM_RESOLVED_EVENT_NAME,
} from '../events';

import type { StatsManager } from '@/StatsManager';
import type { TStats, TStatsPeerConnectionEvents } from '@/StatsPeerConnection';

describe('@MainStreamHealthMonitor', () => {
  let statsEvents: TStatsPeerConnectionEvents;
  let callEvents: TCallEvents;
  let statsManager: StatsManager;
  let callManager: CallManager;

  let mainStream: MediaStream;
  let track: ReturnType<typeof createVideoMediaStreamTrackMock>;
  let isInvalidInboundFrames: boolean;
  let isNoInboundVideoTraffic: boolean;
  let isInboundVideoStalled: boolean;

  const handler = jest.fn();

  beforeEach(() => {
    mainStream = new MediaStream();
    track = createVideoMediaStreamTrackMock({ id: 'v1' });
    statsEvents = createStatsEvents();
    callEvents = createCallEvents();
    isInvalidInboundFrames = false;
    isNoInboundVideoTraffic = false;
    isInboundVideoStalled = false;
    statsManager = {
      on: statsEvents.on.bind(statsEvents),
      get isInvalidInboundFrames() {
        return isInvalidInboundFrames;
      },
      get isNoInboundVideoTraffic() {
        return isNoInboundVideoTraffic;
      },
      get isInboundVideoStalled() {
        return isInboundVideoStalled;
      },
    } as unknown as StatsManager;
    callManager = {
      on: callEvents.on.bind(callEvents),
      getMainRemoteStream: () => {
        return mainStream;
      },
    } as unknown as CallManager;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('HEALTH_SNAPSHOT_EVENT_NAME', () => {
    it('должен эмитить событие когда основной видеотрек muted и StatsManager.isInvalidInboundFrames возвращает true', () => {
      mainStream.addTrack(track);

      Object.defineProperty(track, 'muted', { value: true, configurable: true });
      isInvalidInboundFrames = true;

      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(HEALTH_SNAPSHOT_EVENT_NAME, handler);
      statsEvents.trigger('collected', {} as TStats);

      expect(handler).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(handler.mock.calls[0]?.[0]).toEqual({
        isMutedMainVideoTrack: true,
        isInvalidInboundFrames: true,
        isNoInboundVideoTraffic: false,
        isInboundVideoStalled: false,
      });
    });

    it('должен эмитить событие когда StatsManager.isInvalidInboundFrames возвращает false', () => {
      mainStream.addTrack(track);

      Object.defineProperty(track, 'muted', { value: true, configurable: true });
      isInvalidInboundFrames = false;

      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(HEALTH_SNAPSHOT_EVENT_NAME, handler);
      statsEvents.trigger('collected', {} as TStats);

      expect(handler).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(handler.mock.calls[0]?.[0]).toEqual({
        isMutedMainVideoTrack: true,
        isInvalidInboundFrames: false,
        isNoInboundVideoTraffic: false,
        isInboundVideoStalled: false,
      });
    });

    it('должен эмитить событие когда основной видеотрек не muted', () => {
      mainStream.addTrack(track);

      Object.defineProperty(track, 'muted', { value: false, configurable: true });
      isInvalidInboundFrames = true;

      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(HEALTH_SNAPSHOT_EVENT_NAME, handler);
      statsEvents.trigger('collected', {} as TStats);

      expect(handler).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(handler.mock.calls[0]?.[0]).toEqual({
        isMutedMainVideoTrack: false,
        isInvalidInboundFrames: true,
        isNoInboundVideoTraffic: false,
        isInboundVideoStalled: false,
      });
    });

    it('должен эмитить событие когда в основном потоке нет видеотреков', () => {
      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(HEALTH_SNAPSHOT_EVENT_NAME, handler);
      isInvalidInboundFrames = true;
      statsEvents.trigger('collected', {} as TStats);

      expect(handler).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(handler.mock.calls[0]?.[0]).toEqual({
        isMutedMainVideoTrack: false,
        isInvalidInboundFrames: true,
        isNoInboundVideoTraffic: false,
        isInboundVideoStalled: false,
      });
    });
  });

  describe('INBOUND_VIDEO_PROBLEM_DETECTED_EVENT_NAME', () => {
    it('должен эмитить событие после двух подряд сэмплов stalled inbound video', () => {
      isInboundVideoStalled = true;

      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(INBOUND_VIDEO_PROBLEM_DETECTED_EVENT_NAME, handler);
      statsEvents.trigger('collected', {} as TStats);
      statsEvents.trigger('collected', {} as TStats);

      expect(handler).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(handler.mock.calls[0]?.[0]).toEqual({
        reason: 'inbound-video-stalled',
        consecutiveProblemSamplesCount: 2,
        isMutedMainVideoTrack: false,
        isInvalidInboundFrames: false,
        isNoInboundVideoTraffic: false,
        isInboundVideoStalled: true,
      });
    });

    it('не должен эмитить событие повторно пока длится одна и та же проблема', () => {
      isInboundVideoStalled = true;

      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(INBOUND_VIDEO_PROBLEM_DETECTED_EVENT_NAME, handler);
      statsEvents.trigger('collected', {} as TStats);
      statsEvents.trigger('collected', {} as TStats);
      statsEvents.trigger('collected', {} as TStats);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('должен сбрасывать последовательность после healthy состояния', () => {
      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(INBOUND_VIDEO_PROBLEM_DETECTED_EVENT_NAME, handler);

      isNoInboundVideoTraffic = true;
      statsEvents.trigger('collected', {} as TStats);
      statsEvents.trigger('collected', {} as TStats);

      isNoInboundVideoTraffic = false;
      statsEvents.trigger('collected', {} as TStats);

      isNoInboundVideoTraffic = true;
      statsEvents.trigger('collected', {} as TStats);

      expect(handler).toHaveBeenCalledTimes(1);

      statsEvents.trigger('collected', {} as TStats);

      expect(handler).toHaveBeenCalledTimes(2);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(handler.mock.calls[1]?.[0]).toEqual({
        reason: 'no-inbound-video-traffic',
        consecutiveProblemSamplesCount: 2,
        isMutedMainVideoTrack: false,
        isInvalidInboundFrames: false,
        isNoInboundVideoTraffic: true,
        isInboundVideoStalled: false,
      });
    });
  });

  describe('INBOUND_VIDEO_PROBLEM_RESOLVED_EVENT_NAME', () => {
    it('должен эмитить событие когда подтвержденная проблема уходит', () => {
      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(INBOUND_VIDEO_PROBLEM_RESOLVED_EVENT_NAME, handler);

      isInboundVideoStalled = true;
      statsEvents.trigger('collected', {} as TStats);
      statsEvents.trigger('collected', {} as TStats);

      isInboundVideoStalled = false;
      statsEvents.trigger('collected', {} as TStats);

      expect(handler).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(handler.mock.calls[0]?.[0]).toEqual({
        reason: 'inbound-video-stalled',
        isMutedMainVideoTrack: false,
        isInvalidInboundFrames: false,
        isNoInboundVideoTraffic: false,
        isInboundVideoStalled: false,
      });
    });

    it('не должен эмитить событие когда проблема еще не была подтверждена', () => {
      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(INBOUND_VIDEO_PROBLEM_RESOLVED_EVENT_NAME, handler);

      isNoInboundVideoTraffic = true;
      statsEvents.trigger('collected', {} as TStats);

      isNoInboundVideoTraffic = false;
      statsEvents.trigger('collected', {} as TStats);

      expect(handler).toHaveBeenCalledTimes(0);
    });
  });

  describe('INBOUND_VIDEO_PROBLEM_RESET_EVENT_NAME', () => {
    it('должен эмитить событие когда подтвержденная проблема сбрасывается из-за ended', () => {
      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(INBOUND_VIDEO_PROBLEM_RESET_EVENT_NAME, handler);

      isNoInboundVideoTraffic = true;
      statsEvents.trigger('collected', {} as TStats);
      statsEvents.trigger('collected', {} as TStats);

      callEvents.trigger('ended', {
        originator: 'local',
        // @ts-expect-error test payload
        message: {},
        cause: 'error',
      });

      expect(handler).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(handler.mock.calls[0]?.[0]).toEqual({
        reason: 'no-inbound-video-traffic',
        resetCause: 'ended',
      });
    });

    it('не должен эмитить событие когда проблема еще не была подтверждена', () => {
      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(INBOUND_VIDEO_PROBLEM_RESET_EVENT_NAME, handler);

      isNoInboundVideoTraffic = true;
      statsEvents.trigger('collected', {} as TStats);

      callEvents.trigger('recv-session-started');

      expect(handler).toHaveBeenCalledTimes(0);
    });
  });
});
