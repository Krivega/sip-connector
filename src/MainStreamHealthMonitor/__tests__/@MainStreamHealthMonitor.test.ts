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

const createStats = ({
  framesReceived,
  framesDecoded,
}: {
  framesReceived?: number;
  framesDecoded?: number;
}): TStats => {
  return {
    outbound: { video: {}, secondVideo: {}, audio: {}, additional: {} },
    inbound: {
      video: {
        inboundRtp: { framesReceived, framesDecoded } as unknown as RTCInboundRtpStreamStats,
      },
      secondVideo: {},
      audio: {},
      additional: {},
    },
  } as unknown as TStats;
};

describe('@MainStreamHealthMonitor', () => {
  let statsEvents: TypedEvents<TStatsEventMap>;
  let statsManager: StatsManager;
  let callManager: CallManager;

  let mainStream: MediaStream;
  let track: ReturnType<typeof createVideoMediaStreamTrackMock>;

  const handler = jest.fn();

  beforeEach(() => {
    mainStream = new MediaStream();
    track = createVideoMediaStreamTrackMock({ id: 'v1' });
    statsEvents = createStatsEvents();
    statsManager = { on: statsEvents.on.bind(statsEvents) } as unknown as StatsManager;
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
    it('должен эмитить событие когда основной видеотрек muted, а inbound не получает и не декодирует кадры', () => {
      mainStream.addTrack(track);

      Object.defineProperty(track, 'muted', { value: true, configurable: true });

      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(NO_INBOUND_FRAMES_EVENT_NAME, handler);
      statsEvents.trigger('collected', createStats({ framesReceived: 0, framesDecoded: 0 }));

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('должен эмитить событие когда основной видеотрек muted, а inbound не декодирует кадры', () => {
      mainStream.addTrack(track);

      Object.defineProperty(track, 'muted', { value: true, configurable: true });

      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(NO_INBOUND_FRAMES_EVENT_NAME, handler);
      statsEvents.trigger('collected', createStats({ framesReceived: 1, framesDecoded: 0 }));

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('не должен эмитить событие когда основной видеотрек не muted', () => {
      mainStream.addTrack(track);

      Object.defineProperty(track, 'muted', { value: false, configurable: true });

      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(NO_INBOUND_FRAMES_EVENT_NAME, handler);
      statsEvents.trigger('collected', createStats({ framesReceived: 0, framesDecoded: 0 }));

      expect(handler).toHaveBeenCalledTimes(0);
    });

    it('не должен эмитить событие когда inbound получает и декодирует кадры кадры', () => {
      mainStream.addTrack(track);

      Object.defineProperty(track, 'muted', { value: true, configurable: true });

      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(NO_INBOUND_FRAMES_EVENT_NAME, handler);
      statsEvents.trigger('collected', createStats({ framesReceived: 1, framesDecoded: 1 }));

      expect(handler).toHaveBeenCalledTimes(0);
    });

    it('не должен эмитить событие когда нет inbound потоков', () => {
      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(NO_INBOUND_FRAMES_EVENT_NAME, handler);
      statsEvents.trigger('collected', createStats({ framesReceived: 0, framesDecoded: 0 }));

      expect(handler).toHaveBeenCalledTimes(0);
    });

    it('не должен эмитить событие когда в основном потоке нет видеотреков', () => {
      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(NO_INBOUND_FRAMES_EVENT_NAME, handler);
      statsEvents.trigger('collected', createStats({ framesReceived: 0, framesDecoded: 0 }));

      expect(handler).toHaveBeenCalledTimes(0);
    });

    it('должен эмитить событие когда основной видеотрек muted, а inbound перестал получать кадры', () => {
      mainStream.addTrack(track);

      Object.defineProperty(track, 'muted', { value: true, configurable: true });

      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(NO_INBOUND_FRAMES_EVENT_NAME, handler);
      statsEvents.trigger('collected', createStats({ framesReceived: 1, framesDecoded: 1 }));
      statsEvents.trigger('collected', createStats({ framesReceived: 2, framesDecoded: 2 }));
      statsEvents.trigger('collected', createStats({ framesReceived: 2, framesDecoded: 2 }));

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('должен эмитить событие когда основной видеотрек muted, а inbound перестал декодировать кадры', () => {
      mainStream.addTrack(track);

      Object.defineProperty(track, 'muted', { value: true, configurable: true });

      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(NO_INBOUND_FRAMES_EVENT_NAME, handler);
      statsEvents.trigger('collected', createStats({ framesReceived: 1, framesDecoded: 1 }));
      statsEvents.trigger('collected', createStats({ framesReceived: 2, framesDecoded: 2 }));
      statsEvents.trigger('collected', createStats({ framesReceived: 3, framesDecoded: 2 }));

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('не должен эмитить событие когда основной видеотрек muted, а inbound продолжает получать и декодировать кадры', () => {
      mainStream.addTrack(track);

      Object.defineProperty(track, 'muted', { value: true, configurable: true });

      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      monitor.on(NO_INBOUND_FRAMES_EVENT_NAME, handler);
      statsEvents.trigger('collected', createStats({ framesReceived: 1, framesDecoded: 1 }));
      statsEvents.trigger('collected', createStats({ framesReceived: 2, framesDecoded: 2 }));
      statsEvents.trigger('collected', createStats({ framesReceived: 3, framesDecoded: 3 }));

      expect(handler).toHaveBeenCalledTimes(0);
    });

    it('reset: должен очистить данные о предыдущем состоянии основного потока', () => {
      mainStream.addTrack(track);

      Object.defineProperty(track, 'muted', { value: true, configurable: true });

      const monitor = new MainStreamHeathMonitor(statsManager, callManager);

      const stats = createStats({ framesReceived: 1, framesDecoded: 1 });

      statsEvents.trigger('collected', stats);

      // @ts-expect-error - доступ к приватному свойству
      expect(monitor.previousStats).toEqual(stats);

      monitor.reset();

      // @ts-expect-error - доступ к приватному свойству
      expect(monitor.previousStats).toBe(undefined);
    });
  });
});
