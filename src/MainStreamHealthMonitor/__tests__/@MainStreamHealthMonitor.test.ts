import { TypedEvents } from 'events-constructor';
import { createVideoMediaStreamTrackMock } from 'webrtc-mock';

import MainStreamHeathMonitor from '../@MainStreamHealthMonitor';
import { NO_INBOUND_FRAMES_EVENT_NAME } from '../eventNames';

import type { CallManager } from '@/CallManager';
import type { StatsManager } from '@/StatsManager';
import type { TEventMap as TStatsEventMap } from '@/StatsPeerConnection';
import type { TStats } from '../types';

const createStatsEvents = () => {
  return new TypedEvents<TStatsEventMap>(['collected'] as const);
};

describe('@MainStreamHealthMonitor', () => {
  let statsEvents: TypedEvents<TStatsEventMap>;
  let statsManager: StatsManager;
  let callManager: CallManager;

  let mainStream: MediaStream;
  let track: ReturnType<typeof createVideoMediaStreamTrackMock>;
  let isNotValidFramesStats: boolean;

  const handler = jest.fn();

  beforeEach(() => {
    mainStream = new MediaStream();
    track = createVideoMediaStreamTrackMock({ id: 'v1' });
    statsEvents = createStatsEvents();
    isNotValidFramesStats = false;
    statsManager = {
      on: statsEvents.on.bind(statsEvents),
      get isNotValidFramesStats() {
        return isNotValidFramesStats;
      },
    } as unknown as StatsManager;
    callManager = {
      getMainStream: () => {
        return mainStream;
      },
    } as unknown as CallManager;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('NO_INBOUND_FRAMES_EVENT_NAME', () => {
    it('должен эмитить событие когда основной видеотрек muted и StatsManager.isNotValidFramesStats возвращает true', () => {
      mainStream.addTrack(track);

      Object.defineProperty(track, 'muted', { value: true, configurable: true });
      isNotValidFramesStats = true;

      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(NO_INBOUND_FRAMES_EVENT_NAME, handler);
      statsEvents.trigger('collected', {} as TStats);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('не должен эмитить событие когда StatsManager.isNotValidFramesStats возвращает false', () => {
      mainStream.addTrack(track);

      Object.defineProperty(track, 'muted', { value: true, configurable: true });
      isNotValidFramesStats = false;

      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(NO_INBOUND_FRAMES_EVENT_NAME, handler);
      statsEvents.trigger('collected', {} as TStats);

      expect(handler).toHaveBeenCalledTimes(0);
    });

    it('не должен эмитить событие когда основной видеотрек не muted', () => {
      mainStream.addTrack(track);

      Object.defineProperty(track, 'muted', { value: false, configurable: true });
      isNotValidFramesStats = true;

      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(NO_INBOUND_FRAMES_EVENT_NAME, handler);
      statsEvents.trigger('collected', {} as TStats);

      expect(handler).toHaveBeenCalledTimes(0);
    });

    it('не должен эмитить событие когда в основном потоке нет видеотреков', () => {
      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(NO_INBOUND_FRAMES_EVENT_NAME, handler);
      isNotValidFramesStats = true;
      statsEvents.trigger('collected', {} as TStats);

      expect(handler).toHaveBeenCalledTimes(0);
    });
  });
});
