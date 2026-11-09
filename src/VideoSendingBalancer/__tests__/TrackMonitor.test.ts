import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import logger from '@/logger';
import { createMockTrack } from '../__fixtures__';
import { TrackMonitor } from '../TrackMonitor';

jest.mock('@/logger');

const { mcuDebugLogger } = logger as jest.Mock & { mcuDebugLogger: jest.Mock };

describe('TrackMonitor', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('calls callback on size change via polling', () => {
    const { track, setWidth } = createMockTrack(640); // no resize event support

    const sender = new RTCRtpSenderMock({ track });
    const connection = new RTCPeerConnectionMock(undefined, [track]);

    Object.defineProperty(connection, 'getSenders', {
      value: () => {
        return [sender];
      },
    });

    const callback = jest.fn();
    const monitor = new TrackMonitor({ pollIntervalMs: 500 });

    monitor.subscribe(sender, callback);
    expect(callback).not.toHaveBeenCalled();

    setWidth(320);
    jest.advanceTimersByTime(500);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls callback after replaceTrack and monitors new track', async () => {
    const original = createMockTrack(640);
    const newTrackMock = createMockTrack(800);

    const sender = new RTCRtpSenderMock({ track: original.track });

    const connection = new RTCPeerConnectionMock(undefined, [original.track]);

    Object.defineProperty(connection, 'getSenders', {
      value: () => {
        return [sender];
      },
    });

    const callback = jest.fn();
    const monitor = new TrackMonitor({ pollIntervalMs: 500 });

    monitor.subscribe(sender, callback);

    // Replace track (the monitor patched replaceTrack internally)
    await (sender as RTCRtpSender).replaceTrack(newTrackMock.track);

    // Callback should be called once for replaceTrack
    expect(callback).toHaveBeenCalledTimes(1);

    // Теперь меняем размеры нового трека и прокручиваем таймеры — колбэк должен сработать второй раз
    newTrackMock.setWidth(640);
    jest.advanceTimersByTime(1000);

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('calls callback on size change via polling (Safari fallback)', () => {
    const { track, setWidth } = createMockTrack(640); // no resize event support

    const sender = new RTCRtpSenderMock({ track });
    const connection = new RTCPeerConnectionMock(undefined, [track]);

    Object.defineProperty(connection, 'getSenders', {
      value: () => {
        return [sender];
      },
    });

    const callback = jest.fn();
    const monitor = new TrackMonitor({ pollIntervalMs: 500 });

    monitor.subscribe(sender, callback);
    expect(callback).not.toHaveBeenCalled();

    setWidth(320);
    jest.advanceTimersByTime(500);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does nothing when connection is undefined', () => {
    const callback = jest.fn();
    const monitor = new TrackMonitor({ pollIntervalMs: 500 });

    expect(() => {
      monitor.subscribe(undefined, callback);
    }).not.toThrow();

    expect(callback).not.toHaveBeenCalled();
  });

  it('does nothing when getSenders returns no video sender', () => {
    const connection = new RTCPeerConnectionMock(undefined, []);

    Object.defineProperty(connection, 'getSenders', {
      value: () => {
        return [];
      },
    });

    const callback = jest.fn();
    const monitor = new TrackMonitor({ pollIntervalMs: 500 });

    monitor.subscribe(undefined, callback);

    expect(callback).not.toHaveBeenCalled();
  });

  it('handles replaceTrack(null) and does not start polling for undefined track', async () => {
    const original = createMockTrack(640);

    const sender = new RTCRtpSenderMock({ track: original.track });
    const connection = new RTCPeerConnectionMock(undefined, [original.track]);

    Object.defineProperty(connection, 'getSenders', {
      value: () => {
        return [sender];
      },
    });

    const callback = jest.fn();
    const monitor = new TrackMonitor({ pollIntervalMs: 500 });

    monitor.subscribe(sender, callback);

    // eslint-disable-next-line unicorn/no-null
    await sender.replaceTrack(null);

    // callback должен вызваться (handleTrackResize), но polling не запускается
    expect(callback).toHaveBeenCalledTimes(1);
  });

  describe('adaptive polling', () => {
    it('doubles interval when no size changes detected', () => {
      const { track } = createMockTrack(640);

      const sender = new RTCRtpSenderMock({ track });

      const callback = jest.fn();

      const monitor = new TrackMonitor({ pollIntervalMs: 100 });

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      monitor.subscribe(sender, callback);

      // Первый вызов setTimeout должен быть с базовым интервалом 100мс
      expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
      expect(setTimeoutSpy.mock.calls[0][1]).toBe(100);

      // Прокручиваем первый интервал — изменений нет
      jest.advanceTimersByTime(100);

      // Должен быть запланирован второй таймаут с удвоенным интервалом (200мс)
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
      expect(setTimeoutSpy.mock.calls[1][1]).toBe(200);

      // Колбэк не должен вызываться, так как размер не менялся
      expect(callback).not.toHaveBeenCalled();

      setTimeoutSpy.mockRestore();
    });

    it('interval сбрасывается после изменения размера', () => {
      const { track, setWidth } = createMockTrack(640);

      const sender = new RTCRtpSenderMock({ track });
      const callback = jest.fn();

      const monitor = new TrackMonitor({ pollIntervalMs: 100 });

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      monitor.subscribe(sender, callback);

      // Первый цикл – без изменений
      jest.advanceTimersByTime(100);

      // Изменяем размер, но колбэк пока не должен вызваться, так как проверка будет во втором цикле
      setWidth(320);

      jest.advanceTimersByTime(200); // ждём второй опрос (200мс)

      // Колбэк должен быть вызван один раз после обнаружения изменения
      expect(callback).toHaveBeenCalledTimes(1);

      // После изменения интервал должен сброситься до базового 100мс
      const lastCallArgs = setTimeoutSpy.mock.calls.at(-1);

      // @ts-expect-error
      expect(lastCallArgs[1]).toBe(100);

      setTimeoutSpy.mockRestore();
    });
  });

  describe('хуки замены трека', () => {
    let log: string[];
    let original: ReturnType<typeof createMockTrack>;
    let next: ReturnType<typeof createMockTrack>;
    let sender: RTCRtpSender;
    let originalReplaceTrack: jest.SpyInstance;
    let beforeReplaceTrack: jest.Mock;
    let afterReplaceTrack: jest.Mock;
    let callback: jest.Mock;
    let monitor: TrackMonitor;

    beforeEach(() => {
      log = [];
      original = createMockTrack(640);
      next = createMockTrack(1280);
      sender = new RTCRtpSenderMock({ track: original.track });
      originalReplaceTrack = jest.spyOn(sender, 'replaceTrack');
      originalReplaceTrack.mockImplementation(async (track: MediaStreamTrack | null) => {
        log.push('original');
        (sender as RTCRtpSenderMock).track = track;
      });
      beforeReplaceTrack = jest.fn(async () => {
        log.push('before');
      });
      afterReplaceTrack = jest.fn(() => {
        log.push('after');
      });
      callback = jest.fn(() => {
        log.push('callback');
      });
      monitor = new TrackMonitor({ pollIntervalMs: 500, beforeReplaceTrack, afterReplaceTrack });
      monitor.subscribe(sender, callback);
    });

    afterEach(() => {
      monitor.unsubscribe();
    });

    it('должен вызывать beforeReplaceTrack до оригинального replaceTrack, а afterReplaceTrack после него и до callback', async () => {
      await sender.replaceTrack(next.track);

      expect(log).toEqual(['before', 'original', 'after', 'callback']);
      expect(beforeReplaceTrack).toHaveBeenCalledWith(sender, next.track);
      expect(afterReplaceTrack).toHaveBeenCalledWith(sender, next.track);
    });

    it('должен вызывать оригинальный replaceTrack только после завершения beforeReplaceTrack', async () => {
      const beforeDeferred = Promise.withResolvers<undefined>();

      beforeReplaceTrack.mockImplementation(async () => {
        await beforeDeferred.promise;
        log.push('before');
      });

      const replacing = sender.replaceTrack(next.track);

      await Promise.resolve();

      expect(originalReplaceTrack).not.toHaveBeenCalled();

      beforeDeferred.resolve(undefined);
      await replacing;

      expect(log).toEqual(['before', 'original', 'after', 'callback']);
    });

    it('не должен вызывать хуки при replaceTrack(null)', async () => {
      // eslint-disable-next-line unicorn/no-null
      await sender.replaceTrack(null);

      expect(beforeReplaceTrack).not.toHaveBeenCalled();
      expect(afterReplaceTrack).not.toHaveBeenCalled();
      expect(log).toEqual(['original', 'callback']);
    });

    it('не должен вызывать хуки при замене на тот же трек', async () => {
      await sender.replaceTrack(original.track);

      expect(beforeReplaceTrack).not.toHaveBeenCalled();
      expect(afterReplaceTrack).not.toHaveBeenCalled();
      expect(log).toEqual(['original', 'callback']);
    });

    it('должен вызвать afterReplaceTrack и пробросить ошибку оригинального replaceTrack без вызова callback', async () => {
      const error = new Error('replaceTrack failed');

      originalReplaceTrack.mockRejectedValue(error);

      await expect(sender.replaceTrack(next.track)).rejects.toBe(error);
      expect(log).toEqual(['before', 'after']);
      expect(afterReplaceTrack).toHaveBeenCalledWith(sender, next.track);
      expect(callback).not.toHaveBeenCalled();
    });

    it('должен продолжить следить за прежним треком после ошибки оригинального replaceTrack', async () => {
      originalReplaceTrack.mockRejectedValue(new Error('replaceTrack failed'));

      await expect(sender.replaceTrack(next.track)).rejects.toThrow('replaceTrack failed');

      original.setWidth(320);
      jest.advanceTimersByTime(500);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    describe('отключение монитора во время оригинального replaceTrack', () => {
      let originalDeferred: PromiseWithResolvers<undefined>;
      let replacing: Promise<void>;

      beforeEach(async () => {
        originalDeferred = Promise.withResolvers<undefined>();
        originalReplaceTrack.mockImplementation(async (track: MediaStreamTrack | null) => {
          await originalDeferred.promise;
          (sender as RTCRtpSenderMock).track = track;
        });
        replacing = sender.replaceTrack(next.track);
        await Promise.resolve();
        await Promise.resolve();
      });

      it('не должен вызывать callback и следить за новым треком после unsubscribe, но должен вызвать afterReplaceTrack', async () => {
        monitor.unsubscribe();
        originalDeferred.resolve(undefined);
        await replacing;

        next.setWidth(640);
        jest.advanceTimersByTime(2000);

        expect(originalReplaceTrack).toHaveBeenCalledTimes(1);
        expect(afterReplaceTrack).toHaveBeenCalledWith(sender, next.track);
        expect(callback).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(0);
      });

      it('должен следить за новым треком и вызвать callback, если монитор переподключён к тому же sender', async () => {
        monitor.unsubscribe();
        monitor.subscribe(sender, callback);
        originalDeferred.resolve(undefined);
        await replacing;

        expect(callback).toHaveBeenCalledTimes(1);

        next.setWidth(640);
        jest.advanceTimersByTime(500);

        expect(callback).toHaveBeenCalledTimes(2);
      });
    });

    describe('последовательные вызовы replaceTrack', () => {
      let third: ReturnType<typeof createMockTrack>;

      beforeEach(() => {
        third = createMockTrack(320);
        originalReplaceTrack.mockImplementation(async (track: MediaStreamTrack | null) => {
          log.push(`original:${track === next.track ? 'next' : 'third'}`);
          (sender as RTCRtpSenderMock).track = track;
        });
      });

      it('должен выполнять нативные замены в порядке вызова и оставить последний запрошенный трек', async () => {
        const firstOriginal = Promise.withResolvers<undefined>();

        originalReplaceTrack.mockImplementationOnce(async (track: MediaStreamTrack | null) => {
          await firstOriginal.promise;
          log.push('original:next');
          (sender as RTCRtpSenderMock).track = track;
        });

        const firstReplacing = sender.replaceTrack(next.track);
        const secondReplacing = sender.replaceTrack(third.track);

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(originalReplaceTrack).toHaveBeenCalledTimes(1);

        firstOriginal.resolve(undefined);
        await Promise.all([firstReplacing, secondReplacing]);

        expect(log).toEqual([
          'before',
          'original:next',
          'after',
          'callback',
          'before',
          'original:third',
          'after',
          'callback',
        ]);
        expect(sender.track).toBe(third.track);
        expect(beforeReplaceTrack).toHaveBeenNthCalledWith(2, sender, third.track);
      });

      it('должен ждать незавершённую замену после переподключения монитора к тому же sender', async () => {
        const firstOriginal = Promise.withResolvers<undefined>();

        originalReplaceTrack.mockImplementationOnce(async (track: MediaStreamTrack | null) => {
          await firstOriginal.promise;
          log.push('original:next');
          (sender as RTCRtpSenderMock).track = track;
        });

        const firstReplacing = sender.replaceTrack(next.track);

        await Promise.resolve();
        await Promise.resolve();
        monitor.unsubscribe();
        monitor.subscribe(sender, callback);

        const secondReplacing = sender.replaceTrack(third.track);

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(originalReplaceTrack).toHaveBeenCalledTimes(1);

        firstOriginal.resolve(undefined);
        await Promise.all([firstReplacing, secondReplacing]);

        expect(
          log.filter((entry) => {
            return entry.startsWith('original');
          }),
        ).toEqual(['original:next', 'original:third']);
        expect(sender.track).toBe(third.track);
      });

      it('не должен блокировать следующую замену ошибкой предыдущей нативной замены', async () => {
        const error = new Error('first replaceTrack failed');

        originalReplaceTrack.mockRejectedValueOnce(error);

        const firstReplacing = sender.replaceTrack(next.track);
        const secondReplacing = sender.replaceTrack(third.track);

        const results = await Promise.allSettled([firstReplacing, secondReplacing]);

        expect(results).toEqual([
          { status: 'rejected', reason: error },
          { status: 'fulfilled', value: undefined },
        ]);
        expect(sender.track).toBe(third.track);
        expect(originalReplaceTrack).toHaveBeenCalledTimes(2);
      });
    });

    it('должен логировать ошибку beforeReplaceTrack и выполнить замену', async () => {
      const error = new Error('beforeReplaceTrack failed');

      beforeReplaceTrack.mockRejectedValue(error);

      await sender.replaceTrack(next.track);

      expect(mcuDebugLogger).toHaveBeenCalledWith('beforeReplaceTrack: error', error);
      expect(sender.track).toBe(next.track);
      expect(log).toEqual(['original', 'after', 'callback']);
    });
  });
});
