import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { createMockTrack } from '../__fixtures__';
import { TrackMonitor } from '../TrackMonitor';

describe('TrackMonitor', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('calls callback on size change via polling', () => {
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

  test('calls callback after replaceTrack and monitors new track', async () => {
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

  test('calls callback on size change via polling (Safari fallback)', () => {
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

  test('does nothing when connection is undefined', () => {
    const callback = jest.fn();
    const monitor = new TrackMonitor({ pollIntervalMs: 500 });

    expect(() => {
      monitor.subscribe(undefined, callback);
    }).not.toThrow();

    expect(callback).not.toHaveBeenCalled();
  });

  test('does nothing when getSenders returns no video sender', () => {
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

  test('handles replaceTrack(null) and does not start polling for undefined track', async () => {
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
    test('doubles interval when no size changes detected', () => {
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

    test('interval сбрасывается после изменения размера', () => {
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
});
