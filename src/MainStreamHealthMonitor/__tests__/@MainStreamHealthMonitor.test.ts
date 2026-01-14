import { createVideoMediaStreamTrackMock } from 'webrtc-mock';

import { createEvents as createStatsEvents } from '@/StatsPeerConnection';
import MainStreamHeathMonitor from '../@MainStreamHealthMonitor';
import { NO_INBOUND_FRAMES_EVENT_NAME } from '../events';

import type { CallManager } from '@/CallManager';
import type { StatsManager } from '@/StatsManager';
import type { TStats, TStatsPeerConnectionEvents } from '@/StatsPeerConnection';

describe('@MainStreamHealthMonitor', () => {
  let statsEvents: TStatsPeerConnectionEvents;
  let statsManager: StatsManager;
  let callManager: CallManager;

  let mainStream: MediaStream;
  let track: ReturnType<typeof createVideoMediaStreamTrackMock>;
  let isInvalidInboundFrames: boolean;

  const handler = jest.fn();

  beforeEach(() => {
    mainStream = new MediaStream();
    track = createVideoMediaStreamTrackMock({ id: 'v1' });
    statsEvents = createStatsEvents();
    isInvalidInboundFrames = false;
    statsManager = {
      on: statsEvents.on.bind(statsEvents),
      get isInvalidInboundFrames() {
        return isInvalidInboundFrames;
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
    it('должен эмитить событие когда основной видеотрек muted и StatsManager.isInvalidInboundFrames возвращает true', () => {
      mainStream.addTrack(track);

      Object.defineProperty(track, 'muted', { value: true, configurable: true });
      isInvalidInboundFrames = true;

      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(NO_INBOUND_FRAMES_EVENT_NAME, handler);
      statsEvents.trigger('collected', {} as TStats);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('не должен эмитить событие когда StatsManager.isInvalidInboundFrames возвращает false', () => {
      mainStream.addTrack(track);

      Object.defineProperty(track, 'muted', { value: true, configurable: true });
      isInvalidInboundFrames = false;

      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(NO_INBOUND_FRAMES_EVENT_NAME, handler);
      statsEvents.trigger('collected', {} as TStats);

      expect(handler).toHaveBeenCalledTimes(0);
    });

    it('не должен эмитить событие когда основной видеотрек не muted', () => {
      mainStream.addTrack(track);

      Object.defineProperty(track, 'muted', { value: false, configurable: true });
      isInvalidInboundFrames = true;

      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(NO_INBOUND_FRAMES_EVENT_NAME, handler);
      statsEvents.trigger('collected', {} as TStats);

      expect(handler).toHaveBeenCalledTimes(0);
    });

    it('не должен эмитить событие когда в основном потоке нет видеотреков', () => {
      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(NO_INBOUND_FRAMES_EVENT_NAME, handler);
      isInvalidInboundFrames = true;
      statsEvents.trigger('collected', {} as TStats);

      expect(handler).toHaveBeenCalledTimes(0);
    });
  });
});
